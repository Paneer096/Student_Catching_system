# Makarov Mathematical & Statistical Metrics

## 1. The Statistical Derivation of `SKIPS_WITH` (§5.1)

### Why Naive Co-Absence Rules Fail
A naive rule such as *"flag any pair with $\ge 3$ co-absent days"* produces overwhelming false positives. 

Consider two completely independent and unrelated students in a 100-session semester:
- Student $A$ has an absence rate of 15% ($a = 15$).
- Student $B$ has an absence rate of 15% ($b = 15$).

If their absences are purely random and independent, the expected number of shared absences is:
$$\mathbb{E}[C] = \frac{a \times b}{N} = \frac{15 \times 15}{100} = 2.25 \text{ sessions}$$

Under a binomial / Poisson distribution with $\lambda = 2.25$, the probability of sharing 3 or more absences purely by chance is:
$$P(C \ge 3) = 1 - P(C \le 2) \approx 39.1\%$$

In a typical section of 60 students, there are $\binom{60}{2} = 1,770$ student pairs. A naive threshold would falsely flag roughly **690 random pairs as "bunk partners"**!

---

## 2. Rigorous Statistical Model

To prevent false accusations and eliminate noise, Makarov implements a multi-stage statistical validation:

### 1. Partial-Day Bunk Filtering
- Full-day absences are isolated as welfare signals.
- Mass-absence sessions (where $\ge 40\%$ of the section is absent due to college fests, transport strikes, or power cuts) are excluded from pairwise analysis.

### 2. Contingency Analysis
For each student pair $(A, B)$ across $N$ mutually eligible held sessions:
- $a = \sum \text{bunks}(A)$
- $b = \sum \text{bunks}(B)$
- $c = \sum (\text{bunks}(A) \land \text{bunks}(B))$
- $\text{Expected} = \frac{a \times b}{N}$
- $\text{Lift} = \frac{c}{\text{Expected}}$ (measures co-occurrence relative to chance)
- $\text{Jaccard Similarity} = \frac{c}{a + b - c}$ (edge weight)

### 3. Hypergeometric Test (One-Sided Fisher's Exact)
Computes the exact probability of observing $c$ or more co-bunks by chance:
$$p = P(X \ge c) = \sum_{k=c}^{\min(a, b)} \frac{\binom{a}{k} \binom{N - a}{b - k}}{\binom{N}{b}}$$

### 4. False Discovery Rate (FDR) Correction
Makarov applies the **Benjamini-Hochberg (BH)** procedure across all $\binom{M}{2}$ student pairs in the section to control false discoveries at $\alpha = 0.05$:
$$q_{(i)} = \min_{k \ge i} \left( \frac{m}{k} p_{(k)} \right)$$

### 5. Triple Gate for Edge Creation
An edge `SKIPS_WITH` exists **if and only if**:
1. $c \ge 4$ (at least 4 shared unexcused skips)
2. $\text{Lift} \ge 2.0$ (at least $2\times$ more frequent than random independence)
3. $q \le 0.05$ (statistically significant after multiple testing correction)

Edge weight is set to $\text{Jaccard}$. The co-bunk session IDs are retained as immutable audit evidence.
