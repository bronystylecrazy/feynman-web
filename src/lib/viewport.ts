// Feynman already passes preview metadata into the ordinary chat prompt.
// Keep the user's message and slash-command syntax unchanged.
export function researchViewport(activePath?: string, panelOpen = false) {
  return {
    openPaths: activePath ? [activePath] : [],
    activePath,
    rightTab: panelOpen ? 'Research artifacts' : 'Research chat',
    previewTab:
      'Feynman Web rendered view. Markdown, inline LaTeX ($...$), display LaTeX ($$...$$), and fenced mermaid diagrams render natively in the browser. Use these native formats for ordinary answers; do not generate PNG/SVG files merely to display equations or Mermaid. Generate image artifacts when the user asks for an image/export or when a figure requires it. Link intentional figures with Markdown workspace paths.',
  };
}
