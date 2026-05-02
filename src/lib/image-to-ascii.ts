const ASCII_CHARS = " .:-=+*#%@";

export function imageToAscii(
  imageData: ImageData,
  targetCols: number,
  targetRows: number,
): string {
  const { width, height, data } = imageData;
  const cellW = width / targetCols;
  const cellH = height / targetRows;

  const lines: string[] = [];

  for (let row = 0; row < targetRows; row++) {
    let line = "";
    for (let col = 0; col < targetCols; col++) {
      const startX = Math.floor(col * cellW);
      const startY = Math.floor(row * cellH);
      const endX = Math.floor((col + 1) * cellW);
      const endY = Math.floor((row + 1) * cellH);

      let sum = 0;
      let count = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) * (a / 255);
          sum += luminance;
          count++;
        }
      }

      const avg = count > 0 ? sum / count : 0;
      const charIdx = Math.floor((avg / 255) * (ASCII_CHARS.length - 1));
      line += ASCII_CHARS[charIdx];
    }
    lines.push(line);
  }

  return lines.join("\n");
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function imageElementToData(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
): ImageData {
  const canvas = document.createElement("canvas");
  const aspect = img.width / img.height;
  let w = maxWidth;
  let h = Math.round(w / aspect);
  if (h > maxHeight) {
    h = maxHeight;
    w = Math.round(h * aspect);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export async function convertFileToAscii(
  file: File,
  cols: number,
  rows: number,
): Promise<string> {
  const img = await loadImageFromFile(file);
  const data = imageElementToData(img, cols * 2, rows * 2);
  return imageToAscii(data, cols, rows);
}

const STORAGE_KEY = "asciinema-wterm-splash-art";

export function getSavedSplashArt(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveSplashArt(art: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, art);
  } catch {
    // localStorage may be unavailable
  }
}

export function clearSavedSplashArt(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable
  }
}
