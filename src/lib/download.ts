/** Saves a file through the browser's normal download. Nothing leaves the device. */
export function downloadFile(data: string | Uint8Array<ArrayBuffer>, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
