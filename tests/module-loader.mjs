export async function importStandaloneModule(path) {
  const url = new URL(path, import.meta.url);
  return import(url.href);
}
