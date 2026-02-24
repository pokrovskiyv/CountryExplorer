import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportViewAsPDF(element: HTMLElement): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#0f111e",
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`getplace-snapshot-${new Date().toISOString().slice(0, 10)}.pdf`);
}
