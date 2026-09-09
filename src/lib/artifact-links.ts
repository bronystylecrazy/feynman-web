export interface ArtifactLinkContext {
  sourcePath?: string;
  workspacePath?: string;
}

export function artifactUrl(
  href: string,
  context: ArtifactLinkContext = {},
): string {
  if (!href || href.startsWith('#') || href.startsWith('//')) return href;
  let path = href;
  if (/^file:/i.test(path)) {
    try {
      path = decodeURIComponent(new URL(path).pathname);
    } catch {
      return href;
    }
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return href;
  const root = context.workspacePath?.replace(/\/$/, '');
  if (root && path.startsWith(`${root}/`)) path = path.slice(root.length + 1);
  const workspaceRelative =
    /^(?:\.\/|\/)?(?:outputs|papers|notes)\//.test(path) ||
    path === 'CHANGELOG.md';
  const sourceDirectory =
    context.sourcePath?.slice(0, context.sourcePath.lastIndexOf('/') + 1) ?? '';
  if (!workspaceRelative && (path.startsWith('/') || !sourceDirectory))
    return href;
  try {
    const resolved = new URL(
      path.replace(/^\//, ''),
      `https://workspace.invalid/${workspaceRelative ? '' : sourceDirectory}`,
    );
    const artifactPath = decodeURIComponent(resolved.pathname.slice(1));
    if (
      !/^(outputs|papers|notes)\//.test(artifactPath) &&
      artifactPath !== 'CHANGELOG.md'
    )
      return href;
    return `/api/file/download?path=${encodeURIComponent(artifactPath)}${resolved.hash}`;
  } catch {
    return href;
  }
}
