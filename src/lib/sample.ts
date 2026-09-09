export const sampleResearch = `# From question to evidence

A research workspace should make the reasoning inspectable. Keep the **claim**, its source, and the method together.

## Read the mathematics

For a Bayesian update, prior beliefs meet observed evidence:

$$
P(H \\mid D) = \\frac{P(D \\mid H)\\,P(H)}{P(D)}
$$

Here, $H$ is a hypothesis and $D$ is the observed data.

## Follow the research

\`\`\`mermaid
flowchart LR
  Q[Question] --> S[Sources]
  S --> E[Evidence]
  E --> V[Verification]
  V --> R[Research brief]
\`\`\`

| Artifact | What to inspect |
| --- | --- |
| Research brief | Claims and citations |
| Experiment | Code, data, and results |
| Provenance | Source accounting and verification |

## Inspect the method

\`\`\`python
def bayes_update(prior, likelihood, evidence):
    return likelihood * prior / evidence
\`\`\`

> This is a rendering example, not the result of a research run. Connect Feynman to work with your own sources and artifacts.
`;
