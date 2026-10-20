/**
 * Saves a blob as a file. Uses an anchor with `download` where the browser honours it
 * (desktop browsers, Android Chrome, iOS Safari 13+). Browsers that ignore the attribute
 * open the blob in a tab instead, from which the PDF viewer offers Save.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const supportsDownload = "download" in document.createElement("a");
  if (!supportsDownload) {
    window.open(url, "_blank");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  // Revoke late: some mobile browsers start reading the blob after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
