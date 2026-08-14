import { useCallback, useEffect, useRef, useState } from "react";
import { Download, IdCard } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import Loading from "../components/Loading";
import EmployeeIDCard from "../components/idcard/EmployeeIDCard";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const IDCards = () => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const cardRefs = useRef({}); // employeeId -> DOM node

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/id-cards");
      setEmployees(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const barcodeValueFor = (emp) =>
    emp?.employeeId || emp?.nationalIdNumber || "";

  const captureCard = async (el) => {
    // wait a frame to ensure barcode SVG is painted
    await new Promise((r) => requestAnimationFrame(r));

    return html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
  };

  const downloadSinglePDF = async (emp) => {
    try {
      const el = cardRefs.current[emp.employeeId];
      if (!el) return toast.error("Card not ready");

      const canvas = await captureCard(el);
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();

      const imgW = pageW - 30;
      const imgH = (canvas.height * imgW) / canvas.width;

      pdf.addImage(imgData, "PNG", 15, 20, imgW, imgH);
      pdf.save(
        `ID_Card_${(emp.name || emp.employeeId).replaceAll(" ", "_")}.pdf`,
      );
    } catch (err) {
      toast.error(err?.message || "Failed to download");
    }
  };

  const downloadAllPDF = async () => {
    try {
      if (employees.length === 0) return toast.error("No employees found");
      setDownloadingAll(true);

      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();

      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        const el = cardRefs.current[emp.employeeId];
        if (!el) continue;

        const canvas = await captureCard(el);
        const imgData = canvas.toDataURL("image/png");

        const imgW = pageW - 30;
        const imgH = (canvas.height * imgW) / canvas.width;

        if (i !== 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 15, 20, imgW, imgH);
      }

      pdf.save(
        `All_Employee_ID_Cards_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      toast.error(err?.message || "Failed to download all");
    } finally {
      setDownloadingAll(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <IdCard className="w-6 h-6 text-indigo-600" />
          Employee ID Cards
        </h1>
        <p className="page-subtitle">
          Admin-only: view and download employee ID cards
        </p>
      </div>

      <div className="card p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">Total Employees</p>
          <p className="text-sm text-slate-500">{employees.length} cards</p>
        </div>

        <button
          onClick={downloadAllPDF}
          disabled={downloadingAll}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Download className="w-4 h-4" />
          {downloadingAll ? "Preparing..." : "Download All (PDF)"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {employees.map((emp) => (
          <div key={emp.employeeId} className="card p-5 sm:p-6">
            <div className="flex justify-center">
              <EmployeeIDCard
                employee={emp}
                barcodeValue={barcodeValueFor(emp)}
                cardRefProp={(node) => {
                  if (node) cardRefs.current[emp.employeeId] = node;
                }}
              />
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => downloadSinglePDF(emp)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IDCards;
