import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, IdCard, Search, X } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import Loading from "../components/Loading";
import EmployeeIDCard from "../components/idcard/EmployeeIDCard";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const CARD_W_PX = 360;

const IDCards = () => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [query, setQuery] = useState("");

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

  // ✅ Search: Name OR NIC OR Employee ID
  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;

    return employees.filter((e) => {
      const name = (e.name || `${e.firstName || ""} ${e.lastName || ""}`)
        .trim()
        .toLowerCase();
      const nic = (e.nationalIdNumber || "").toLowerCase();
      const empId = (e.employeeId || e.id || "").toLowerCase();

      return name.includes(q) || nic.includes(q) || empId.includes(q);
    });
  }, [employees, query]);

  // ✅ Capture card into canvas (stable/offscreen)
  const captureCard = useCallback(async (el) => {
    const wrapper = document.createElement("div");
    wrapper.style.width = `${CARD_W_PX}px`;
    wrapper.style.background = "#ffffff";
    wrapper.style.position = "fixed";
    wrapper.style.left = "-99999px";
    wrapper.style.top = "0";
    wrapper.style.pointerEvents = "none";
    wrapper.style.zIndex = "999999";
    wrapper.style.padding = "0";
    wrapper.style.margin = "0";

    const clone = el.cloneNode(true);
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // wait for fonts
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    // wait for images
    const imgs = wrapper.querySelectorAll("img");
    await Promise.all(
      Array.from(imgs).map((img) =>
        img.decode ? img.decode().catch(() => {}) : Promise.resolve(),
      ),
    );

    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 40));

    const canvas = await html2canvas(wrapper, {
      scale: 4,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
    });

    document.body.removeChild(wrapper);
    return canvas;
  }, []);

  // ✅ Save PDF with NO white margins (page size == card size)
  const saveCanvasAsPdfExact = useCallback((canvas, filename) => {
    const imgData = canvas.toDataURL("image/png");
    const orientation = canvas.width > canvas.height ? "l" : "p";

    const pdf = new jsPDF({
      orientation,
      unit: "px",
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
  }, []);

  const downloadSinglePDF = useCallback(
    async (emp) => {
      try {
        const el = cardRefs.current[emp.employeeId];
        if (!el) return toast.error("Card not ready");

        const canvas = await captureCard(el);
        saveCanvasAsPdfExact(
          canvas,
          `ID_Card_${(emp.name || emp.employeeId).replaceAll(" ", "_")}.pdf`,
        );
      } catch (err) {
        toast.error(err?.message || "Failed to download");
      }
    },
    [captureCard, saveCanvasAsPdfExact],
  );

  // ✅ Download All = Download FILTERED results
  const downloadAllPDF = useCallback(async () => {
    try {
      if (filteredEmployees.length === 0) {
        return toast.error("No matching employees to download");
      }

      setDownloadingAll(true);

      let pdf = null;

      for (let i = 0; i < filteredEmployees.length; i++) {
        const emp = filteredEmployees[i];
        const el = cardRefs.current[emp.employeeId];
        if (!el) continue;

        const canvas = await captureCard(el);
        const imgData = canvas.toDataURL("image/png");
        const orientation = canvas.width > canvas.height ? "l" : "p";

        if (!pdf) {
          pdf = new jsPDF({
            orientation,
            unit: "px",
            format: [canvas.width, canvas.height],
          });
          pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        } else {
          pdf.addPage([canvas.width, canvas.height], orientation);
          pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        }
      }

      if (!pdf) return toast.error("Cards are not ready to export");

      const suffix = query.trim()
        ? `filtered_${query.trim().replaceAll(" ", "_")}`
        : "all";

      pdf.save(
        `Employee_ID_Cards_${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      toast.error(err?.message || "Failed to download all");
    } finally {
      setDownloadingAll(false);
    }
  }, [captureCard, filteredEmployees, query]);

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <IdCard className="w-6 h-6 text-indigo-600" />
          Employee ID Cards
        </h1>
        <p className="page-subtitle">
          search, view and download employee ID cards
        </p>
      </div>

      {/* Search + Download */}
      <div className="card p-5 sm:p-6 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="w-full lg:max-w-xl">
          <p className="font-medium text-slate-900">Search</p>
          <div className="relative mt-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Name / NIC / Employee ID"
              className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {query.trim() && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-slate-100 text-slate-500"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-sm text-slate-500 mt-2">
            Showing{" "}
            <span className="font-medium text-slate-900">
              {filteredEmployees.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-900">
              {employees.length}
            </span>{" "}
            cards
          </p>
        </div>

        <button
          onClick={downloadAllPDF}
          disabled={downloadingAll || filteredEmployees.length === 0}
          className="btn-primary flex items-center justify-center gap-2 w-full lg:w-auto"
          type="button"
        >
          <Download className="w-4 h-4" />
          {downloadingAll ? "Preparing..." : "Download All (PDF)"}
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredEmployees.map((emp) => (
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
                type="button"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        ))}

        {filteredEmployees.length === 0 && (
          <div className="card p-8 text-center text-slate-500 md:col-span-2 xl:col-span-3">
            No employees match your search.
          </div>
        )}
      </div>
    </div>
  );
};

export default IDCards;
