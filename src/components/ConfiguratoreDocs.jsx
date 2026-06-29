import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import JSZip from "jszip";
import {  FaSignOutAlt} from "react-icons/fa";
export default function ConfiguratoreDocs() {
  const navigate = useNavigate();

  const [selectedFileName, setSelectedFileName] = useState("");
  const [originalOdtFile, setOriginalOdtFile] = useState(null);

  const [globalConfig, setGlobalConfig] = useState({});
  const [pageHashtags, setPageHashtags] = useState({ 1: [] });

  const [outputPdfUrl, setOutputPdfUrl] = useState(null);

  // CARICAMENTO ODT + ESTRAZIONE TAG + ANTEPRIMA PDF
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".odt")) {
      alert("Carica un file ODT valido");
      return;
    }

    setSelectedFileName(file.name);
    setOriginalOdtFile(file);

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const contentXml = await zip.file("content.xml").async("string");

    const regex = /#@#(.*?)#@#/g;
    const tagsFound = [];
    let match;

    while ((match = regex.exec(contentXml)) !== null) {
      tagsFound.push(match[1]);
    }

    setPageHashtags({ 1: tagsFound });

    const initialConfig = {};
    tagsFound.forEach((tag) => {
      initialConfig[tag] = { value: "", type: "UI" };
    });

    setGlobalConfig(initialConfig);

    const previewRes = await fetch("http://localhost:3001/previewOdt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        odt: Array.from(new Uint8Array(arrayBuffer)),
      }),
    });

    if (previewRes.ok) {
      const pdfBlob = await previewRes.blob();
      const urlBlob = URL.createObjectURL(pdfBlob);
      setOutputPdfUrl(urlBlob);
    }
  };

  // GENERA PDF COMPILATO (ODT → PDF)
  const handleGeneratePdf = async () => {
    if (!originalOdtFile) {
      alert("Carica prima un ODT");
      return;
    }

    const odtBuffer = await originalOdtFile.arrayBuffer();

    const replacements = {};
    for (const [tag, cfg] of Object.entries(globalConfig)) {
      replacements[tag] = { value: cfg?.value || "" };
    }

    const res = await fetch("http://localhost:3001/compileOdt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        odt: Array.from(new Uint8Array(odtBuffer)),
        replacements,
      }),
    });

    if (!res.ok) {
      alert("Errore nella generazione del PDF");
      return;
    }

    const pdfBlob = await res.blob();
    const urlBlob = URL.createObjectURL(pdfBlob);
    setOutputPdfUrl(urlBlob);
  };

  const handleChange = (tag, value) => {
    setGlobalConfig((prev) => ({
      ...prev,
      [tag]: {
        ...prev[tag],
        value,
      },
    }));
  };

  const updateFieldConfig = (tag, key, value) => {
    setGlobalConfig((prev) => ({
      ...prev,
      [tag]: {
        ...prev[tag],
        [key]: value,
      },
    }));
  };

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    navigate("/login", { replace: true });
  };
  const currentUser = JSON.parse(sessionStorage.getItem("utenteLoggato"));
  const goHome = () => navigate("/admin");

  return (
    <div className="page-container" style={{ display: "flex", gap: "20px" }}>
      <div style={{ width: "70%" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={goHome}>🏠 Dashboard</button>
          <button onClick={handleLogout}>
                    <FaSignOutAlt style={{ marginRight: "8px" }} />
                    Logout ({currentUser.username || currentUser.email || "Sconosciuto"})
                  </button>
        </div>

        <h2>Configuratore Documenti</h2>

        <div style={{ marginTop: 20 }}>
          <input
            type="file"
            id="fileInput"
            accept=".odt"
            onChange={handleUpload}
            style={{ display: "none" }}
          />

          <button onClick={() => document.getElementById("fileInput").click()}>
            📄 Carica Documento ODT
          </button>

          {selectedFileName && (
            <div style={{ marginTop: 10 }}>
              📎 File selezionato: <strong>{selectedFileName}</strong>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <button onClick={handleGeneratePdf}>🧾 Genera PDF compilato</button>
        </div>

        {outputPdfUrl && (
          <div style={{ marginTop: 20 }}>
            <h3>Anteprima PDF</h3>
            <iframe
              key={outputPdfUrl}
              title="Anteprima PDF"
              src={outputPdfUrl}
              style={{ width: "100%", height: "800px", border: "1px solid #ccc" }}
            />
          </div>
        )}
      </div>

      <div
        style={{
          width: "30%",
          borderLeft: "1px solid #ddd",
          paddingLeft: "20px",
          overflowY: "auto",
          maxHeight: "90vh",
        }}
      >
        <h3>Hashtag nel documento</h3>

        {pageHashtags[1]?.length === 0 && <p>Nessun hashtag trovato.</p>}

        {pageHashtags[1]?.map((tag, index) => (
          <div
            key={tag + "_" + index}
            style={{
              marginBottom: 15,
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 5,
            }}
          >
            <strong>{tag}</strong>

            <select
              style={{ width: "100%", marginTop: 5 }}
              value={globalConfig[tag]?.type || ""}
              onChange={(e) => updateFieldConfig(tag, "type", e.target.value)}
            >
              <option value="">-- Tipo valore --</option>
              <option value="DB">Campo DB</option>
              <option value="DATE">Data</option>
              <option value="UI">Campo UI</option>
              <option value="TEXT">Testo libero</option>
            </select>

            <input
              style={{ width: "100%", marginTop: 5 }}
              placeholder="Valore..."
              value={globalConfig[tag]?.value || ""}
              onChange={(e) => handleChange(tag, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
