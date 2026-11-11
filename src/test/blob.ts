// Reading a downloaded Blob back in a test, as the browser's FileReader gives it.
const read = <T,>(blob: Blob, as: "text" | "bytes" | "binary") =>
  new Promise<T>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve((as === "bytes" ? new Uint8Array(reader.result as ArrayBuffer) : reader.result) as T);
    if (as === "text") reader.readAsText(blob);
    else if (as === "bytes") reader.readAsArrayBuffer(blob);
    else reader.readAsBinaryString(blob);
  });

/** A Blob's text, read as UTF-8. */
export const blobText = (blob: Blob) => read<string>(blob, "text");

/** A Blob's bytes. */
export const blobBytes = (blob: Blob) => read<Uint8Array>(blob, "bytes");

/** A PDF's text as jsPDF writes it (WinAnsi), with its em dash and ellipsis turned back into the characters. */
export const pdfText = async (blob: Blob) =>
  (await read<string>(blob, "binary")).replace(/\x97/g, "—").replace(/\x85/g, "…");
