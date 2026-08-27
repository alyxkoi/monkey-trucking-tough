export interface PrintTicket {
  companyName: string; companyTagline: string; companyAddress: string; companyCityStateZip: string; companyPhone: string;
  ticketNumber: string; createdAt: Date; customerName: string; customerPhone: string; jobSiteAddress: string;
  items: { name: string; detail: string; amount: string }[];
  subtotal: string; deliveryLabel: string; deliveryAmount: string; taxLabel: string; taxAmount: string; total: string;
  driver: string; notes?: string; copies?: number; logoImage?: CanvasImageSource;
}

export type PrintMethod = "share" | "direct";
export const TICKET_LOGO_URL = "https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/email-assets//MT-LOGO.png";
const W = 812, H = 1218, PAD = 40, FEED = 80, CUT_GAP = 34;
const SANS = '"Barlow", Arial, sans-serif';
const DISPLAY = '"Anton", "Arial Black", sans-serif';
const clampCopies = (copies?: number) => Math.min(5, Math.max(1, Math.round(copies ?? 1)));

let ticketLogoPromise: Promise<ImageBitmap> | null = null;

/** Load once, decode completely, and embed into the canvas before PNG export. */
const loadTicketLogo = () => {
  if (!ticketLogoPromise) {
    ticketLogoPromise = fetch(TICKET_LOGO_URL, { mode: "cors", cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Ticket logo could not be loaded (${response.status})`);
        return response.blob();
      })
      .then((blob) => createImageBitmap(blob))
      .catch((error) => {
        ticketLogoPromise = null;
        throw error;
      });
  }
  return ticketLogoPromise;
};

const forceBlackAndWhite = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const pixels = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const luminance = pixels.data[i] * .299 + pixels.data[i + 1] * .587 + pixels.data[i + 2] * .114;
    const value = luminance < 180 ? 0 : 255;
    pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
};

const fitText = (ctx: CanvasRenderingContext2D, value: string, maxWidth: number) => {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let output = value;
  while (output.length > 1 && ctx.measureText(`${output}...`).width > maxWidth) output = output.slice(0, -1);
  return `${output}...`;
};

const makePages = (t: PrintTicket) => t.items.length >= 7
  ? [t.items.slice(0, Math.ceil(t.items.length / 2)), t.items.slice(Math.ceil(t.items.length / 2))]
  : [t.items];

/** Fixed 812×1218, pure one-bit 4×6 labels. Long tickets split across two pages. */
export const renderTicketPng = async (t: PrintTicket): Promise<Blob> => {
  const [, , loadedLogo] = await Promise.all([
    document.fonts?.load(`52px ${DISPLAY}`).catch(() => undefined),
    document.fonts?.load(`700 30px ${SANS}`).catch(() => undefined),
    t.logoImage ? Promise.resolve(t.logoImage) : loadTicketLogo(),
  ]);
  const pages = makePages(t);
  const labels = Array.from({ length: clampCopies(t.copies) }, () => pages).flat();
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H * labels.length + CUT_GAP * Math.max(0, labels.length - 1);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Unable to create label canvas");
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000"; ctx.strokeStyle = "#000"; ctx.textBaseline = "top";
  const font = (size: number, display = false) => { ctx.font = `${display ? 400 : 700} ${size}px ${display ? DISPLAY : SANS}`; };
  const text = (value: string, x: number, y: number, max: number, align: CanvasTextAlign = "left") => {
    ctx.textAlign = align; ctx.fillText(fitText(ctx, value || "-", max), x, y);
  };
  const center = (value: string, y: number, size: number, max = W - PAD * 2, display = false) => {
    font(size, display); text(value, W / 2, y, max, "center");
  };
  const rule = (y: number, thickness = 1) => ctx.fillRect(PAD, Math.round(y), W - PAD * 2, thickness);

  labels.forEach((items, labelIndex) => {
    const offset = labelIndex * (H + CUT_GAP), pageIndex = labelIndex % pages.length;
    const compact = items.length >= 5, logoH = compact ? 124 : 150, infoH = compact ? 98 : 112;
    const customerH = compact ? 94 : 110, itemH = compact ? 58 : 72;
    let y = offset + PAD;
    const logo = loadedLogo as CanvasImageSource & { width?: number; height?: number };
    const maxLogoW = 440, maxLogoH = logoH - 46;
    const sourceW = logo.width ?? maxLogoW, sourceH = logo.height ?? maxLogoH;
    const scale = Math.min(maxLogoW / sourceW, maxLogoH / sourceH);
    const drawW = sourceW * scale, drawH = sourceH * scale;
    ctx.drawImage(logo, (W - drawW) / 2, y, drawW, drawH);
    center("Monkey Trucking LLC", y + logoH - 33, 22, 420);
    if (pages.length > 1) { font(20); text(`Page ${pageIndex + 1} of ${pages.length}`, W - PAD, y + 10, 180, "right"); }
    y += logoH;
    center(t.companyTagline || "Texas Hauling Services and Materials", y, 26);
    center(t.companyAddress, y + 27, 26); center(t.companyCityStateZip, y + 54, 26); center(t.companyPhone, y + 81, 26);
    y += infoH; rule(y, 3); y += 8;
    font(42, true); text(`TICKET #${t.ticketNumber}`, PAD, y, 470);
    font(26); text(`${t.createdAt.toLocaleDateString("en-US")}  ${t.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`, W - PAD, y + 10, 265, "right");
    y += 56; rule(y); y += 8;
    const gap = 30, colW = (W - PAD * 2 - gap) / 2;
    font(20); text("CUSTOMER", PAD, y, colW); text("JOB SITE", PAD + colW + gap, y, colW);
    font(26); text(t.customerName, PAD, y + 28, colW); text(t.jobSiteAddress, PAD + colW + gap, y + 28, colW); text(t.customerPhone, PAD, y + 59, colW);
    y += customerH; rule(y); y += 7;
    items.forEach((item) => {
      font(compact ? 26 : 30); text(item.name, PAD, y, W - PAD * 2);
      font(compact ? 24 : 26); text(item.detail, PAD, y + (compact ? 29 : 36), 470);
      font(30); text(item.amount, W - PAD, y + (compact ? 25 : 33), 240, "right"); y += itemH;
    });
    rule(y); y += 7;
    const labelX = W - PAD - 330, amountX = W - PAD;
    font(28); text("Subtotal", labelX, y, 210, "right"); text(t.subtotal, amountX, y, 190, "right");
    text(t.deliveryLabel, labelX, y + 31, 330, "right"); text(t.deliveryAmount, amountX, y + 31, 190, "right");
    text(t.taxLabel, labelX, y + 62, 210, "right"); text(t.taxAmount, amountX, y + 62, 190, "right");
    y += 96; rule(y, 3); y += 8;
    font(48, true); text("TOTAL", PAD, y + 7, 250); font(60, true); text(t.total, W - PAD, y, 430, "right");
    y += 76; rule(y); y += 9;
    font(24); text(`Driver: ${t.driver || "-"}`, PAD, y, W - PAD * 2); text("Received by:", PAD, y + 43, 180);
    ctx.fillRect(PAD + 165, y + 68, W - PAD * 2 - 165, 2);
    center("Thank you for your business", offset + H - FEED - 36, 24);
  });
  for (let i = 0; i < labels.length - 1; i += 1) {
    const cutY = (i + 1) * H + i * CUT_GAP + CUT_GAP / 2;
    ctx.save(); ctx.setLineDash([14, 10]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, cutY); ctx.lineTo(W - PAD, cutY); ctx.stroke(); ctx.restore();
  }
  forceBlackAndWhite(ctx, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to generate label image")), "image/png"));
};

export const shareOrDownloadPng = async (blob: Blob, filename: string, textValue?: string) => {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: filename, text: textValue }); return "shared"; }
    catch { return "cancelled"; }
  }
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); return "downloaded";
};

export const directPrintPng = async (blob: Blob) => {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow pop-ups to use Direct print.");
  const bitmap = await createImageBitmap(blob);
  const count = Math.max(1, Math.round((bitmap.height + CUT_GAP) / (H + CUT_GAP))), urls: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const page = document.createElement("canvas"); page.width = W; page.height = H;
    const pageCtx = page.getContext("2d", { alpha: false }); if (!pageCtx) continue;
    pageCtx.imageSmoothingEnabled = false; pageCtx.fillStyle = "#fff"; pageCtx.fillRect(0, 0, W, H);
    pageCtx.drawImage(bitmap, 0, i * (H + CUT_GAP), W, H, 0, 0, W, H); urls.push(page.toDataURL("image/png"));
  }
  bitmap.close();
  popup.document.write(`<!doctype html><html><head><title>4x6 Ticket</title><style>@page{size:4in 6in;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}.page{width:4in;height:6in;break-after:page}.page:last-child{break-after:auto}img{display:block;width:4in;height:6in}</style></head><body>${urls.map((url) => `<div class="page"><img src="${url}" alt=""></div>`).join("")}<script>window.onload=()=>setTimeout(()=>window.print(),100);</script></body></html>`);
  popup.document.close(); return "printed";
};

export const outputTicketPng = (blob: Blob, method: PrintMethod, filename: string, textValue?: string) =>
  method === "direct" ? directPrintPng(blob) : shareOrDownloadPng(blob, filename, textValue);
