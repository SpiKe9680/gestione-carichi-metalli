// src/components/Scarichi.js
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { scriviLog } from "../utils/log";
import "./Scarichi.css";

const Scarichi = ({ logout, role, goToDashboard }) => {
  const [fornitori, setFornitori] = useState([]);
  const [listini, setListini] = useState([]);
  const [materiali, setMateriali] = useState([]);

  const [selectedFornitore, setSelectedFornitore] = useState("");
  const [selectedListino, setSelectedListino] = useState("");
  const [selectedCer, setSelectedCer] = useState("");
  const [selectedMateriale, setSelectedMateriale] = useState("");

  const [peso, setPeso] = useState("");
  const [calo, setCalo] = useState("");

  const [scarico, setScarico] = useState([]);

  // ---------------- MODIFICHE PUNTUALI ----------------
  const [usaOra, setUsaOra] = useState(true); // checkbox "Adesso"
  const [dataScaricoStr, setDataScaricoStr] = useState(""); // gg/mm/yyyy
  const [oraStr, setOraStr] = useState(""); // hh:mm

  // ✅ INIZIALIZZAZIONE AUTOMATICA DATA/ORA AL MOUNT
  useEffect(() => {
    if (usaOra) {
      const now = new Date();
      setDataScaricoStr(
        `${String(now.getDate()).padStart(2, "0")}/${String(
          now.getMonth() + 1
        ).padStart(2, "0")}/${now.getFullYear()}`
      );
      setOraStr(
        `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes()
        ).padStart(2, "0")}`
      );
    }
  }, []);

  const handleUsaOraChange = (e) => {
    const checked = e.target.checked;
    setUsaOra(checked);
    if (checked) {
      const now = new Date();
      setDataScaricoStr(
        `${String(now.getDate()).padStart(2, "0")}/${String(
          now.getMonth() + 1
        ).padStart(2, "0")}/${now.getFullYear()}`
      );
      setOraStr(
        `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes()
        ).padStart(2, "0")}`
      );
    } else {
      setDataScaricoStr("");
      setOraStr("");
    }
  };

  // --- gestione input data
  const handleDataInput = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, "").slice(0, 8);
    setDataScaricoStr(val);
  };

  const handleDataBlur = () => {
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    let val = dataScaricoStr;
    if (val.length < 8) {
      val = val.padEnd(8, "0");
    }
    let gg = Number(val.slice(0, 2));
    let mm = Number(val.slice(2, 4));
    let yyyy = Number(val.slice(4, 8));

    if (!gg || !mm || !yyyy) {
      setDataScaricoStr(
        `${String(now.getDate()).padStart(2, "0")}/${String(
          now.getMonth() + 1
        ).padStart(2, "0")}/${now.getFullYear()}`
      );
      return;
    }

    if (gg < 1) gg = 1;
    if (gg > 31) gg = 31;
    if (mm < 1) mm = 1;
    if (mm > 12) mm = 12;
    if (yyyy < now.getFullYear() - 1) yyyy = now.getFullYear() - 1;
    if (yyyy > now.getFullYear()) yyyy = now.getFullYear();

    let newDate = new Date(yyyy, mm - 1, gg);
    if (newDate > now) newDate = now;
    if (newDate < minDate) newDate = minDate;

    setDataScaricoStr(
      `${String(newDate.getDate()).padStart(2, "0")}/${String(
        newDate.getMonth() + 1
      ).padStart(2, "0")}/${newDate.getFullYear()}`
    );
  };

  // --- gestione input ora
  const handleOraInput = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
    setOraStr(val);
  };

  const handleOraBlur = () => {
    const now = new Date();
    let hh = Number(oraStr.slice(0, 2)) || 0;
    let mm = Number(oraStr.slice(2, 4)) || 0;

    if (hh > 23) hh = 23;
    if (mm > 59) mm = 59;

    if (dataScaricoStr) {
      const [dG, dM, dY] = dataScaricoStr.split("/").map(Number);
      const dInput = new Date(dY, dM - 1, dG, hh, mm);
      if (dInput > now) {
        hh = now.getHours();
        mm = now.getMinutes();
      }
    }

    setOraStr(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  };

  const parseDataOra = (dataStr, oraStr) => {
    if (!dataStr) return new Date();
    const [gg, mm, yyyy] = dataStr.split("/").map(Number);
    if (!gg || !mm || !yyyy) return new Date();
    const d = new Date(yyyy, mm - 1, gg);
    if (oraStr) {
      const [hh, min] = oraStr.split(":").map(Number);
      if (!isNaN(hh) && !isNaN(min)) d.setHours(hh, min, 0, 0);
    }
    const now = new Date();
    if (d > now) return now;
    return d;
  };

  // -------- FETCH DATI --------
  useEffect(() => {
    const fetchData = async () => {
      const fornSnap = await getDocs(collection(db, "fornitori"));
      setFornitori(fornSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const listSnap = await getDocs(collection(db, "listini"));
      setListini(listSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const matSnap = await getDocs(collection(db, "materiali"));
      setMateriali(matSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchData();
  }, []);

  // -------- CER DINAMICI --------
  const cerDisponibili = [...new Set(materiali.map((m) => m.codiceCER).filter((c) => c))];

  const materialiFiltrati = selectedCer
    ? materiali.filter((m) => m.codiceCER === selectedCer)
    : [];

  useEffect(() => {
    if (materialiFiltrati.length === 1) {
      setSelectedMateriale(materialiFiltrati[0].nome);
    }
  }, [selectedCer, materialiFiltrati]);

  // -------- AGGIUNGI O AGGIORNA MATERIALI --------
  const handleAdd = () => {
    if (!selectedCer || !selectedMateriale) return;

    const pesoNum = parseFloat(peso.replace(",", ".")) || 0;
    const caloNum = parseFloat(calo.replace(",", ".")) || 0;
    const netto = pesoNum - caloNum;

    setScarico((prev) => {
      const cerIndex = prev.findIndex((c) => c.cer === selectedCer);

      if (cerIndex >= 0) {
        const updated = prev.map((c, i) => {
          if (i === cerIndex) {
            const matIndex = c.righe.findIndex((r) => r.materiale === selectedMateriale);
            let newRighe;
            if (matIndex >= 0) {
              newRighe = [...c.righe];
              newRighe[matIndex] = { materiale: selectedMateriale, peso: pesoNum, calo: caloNum, netto };
            } else {
              newRighe = [...c.righe, { materiale: selectedMateriale, peso: pesoNum, calo: caloNum, netto }];
            }
            const totaleCer = newRighe.reduce((sum, r) => sum + r.netto, 0);
            return { ...c, righe: newRighe, totaleCer };
          }
          return c;
        });
        return updated;
      } else {
        return [
          ...prev,
          { cer: selectedCer, righe: [{ materiale: selectedMateriale, peso: pesoNum, calo: caloNum, netto }], totaleCer: netto },
        ];
      }
    });

    setPeso("");
    setCalo("");
    setSelectedMateriale("");
  };

  // -------- MODIFICA RIGA --------
  const handleEdit = (cer, materiale) => {
    const cerObj = scarico.find((c) => c.cer === cer);
    if (!cerObj) return;

    const riga = cerObj.righe.find((r) => r.materiale === materiale);
    if (!riga) return;

    setSelectedCer(cer);
    setSelectedMateriale(materiale);
    setPeso(riga.peso.toString().replace(".", ","));
    setCalo(riga.calo.toString().replace(".", ","));
  };

  // -------- ELIMINA RIGA --------
  const handleDelete = (cer, materiale) => {
    setScarico((prev) => {
      return prev
        .map((c) => {
          if (c.cer === cer) {
            const newRighe = c.righe.filter((r) => r.materiale !== materiale);
            const totaleCer = newRighe.reduce((sum, r) => sum + r.netto, 0);
            return { ...c, righe: newRighe, totaleCer };
          }
          return c;
        })
        .filter((c) => c.righe.length > 0);
    });
  };

  // -------- RESET --------
  const handleReset = () => {
    setSelectedFornitore("");
    setSelectedListino("");
    setSelectedCer("");
    setSelectedMateriale("");
    setPeso("");
    setCalo("");
    setScarico([]);
    setUsaOra(true);
    setDataScaricoStr("");
    setOraStr("");
  };

  // -------- SALVA SU FIRESTORE + LOG --------
  const handleSave = async () => {
    if (!selectedFornitore || !selectedListino || scarico.length === 0) {
      alert("Seleziona fornitore, listino e almeno un materiale!");
      return;
    }

    try {
      const utente = auth.currentUser?.email || "sconosciuto";

      const dataFinale = usaOra ? serverTimestamp() : parseDataOra(dataScaricoStr, oraStr);

      const docRef = await addDoc(collection(db, "scarichi"), {
        fornitore: selectedFornitore,
        listino: selectedListino,
        scarico,
        utente,
        data: dataFinale,
      });

      await scriviLog({
        pagina: "Scarichi",
        tipo: "CREAZIONE_SCARICO",
        collezioneRef: "scarichi",
        documentoId: docRef.id,
        dati_modificati: {
          id: docRef.id,
          fornitore: selectedFornitore,
          listino: selectedListino,
          scarico,
          utente,
        },
      });

      alert("Scarico salvato correttamente!");
      handleReset();
    } catch (err) {
      console.error("Errore salvataggio scarico:", err);
      alert("Errore salvataggio scarico, vedi console");
    }
  };

  // -------- GENERA PDF --------
  const handlePrint = () => {
    if (!selectedFornitore || !selectedListino || scarico.length === 0) {
      alert("Niente da stampare!");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Fornitore: ${selectedFornitore}`, 10, 10);
    doc.text(`Listino: ${selectedListino}`, 10, 20);

    let y = 30;
    scarico.forEach((c) => {
      doc.setFontSize(14);
      doc.text(`CER ${c.cer}`, 10, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Materiale", "Peso", "Calo", "Netto"]],
        body: c.righe.map((r) => [r.materiale, r.peso, r.calo, r.netto]),
        theme: "grid",
        margin: { left: 10 },
        headStyles: { fillColor: [200, 200, 200] },
        styles: { fontSize: 12 },
      });

      y = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(12);
      doc.text(`Totale CER: ${c.totaleCer.toFixed(2)} kg`, 10, y);
      y += 10;
    });

    doc.save(`Scarico_${selectedFornitore}_${selectedListino}.pdf`);
  };

  const testataBloccata = selectedFornitore && selectedListino;

  return (
    <div className="scarichi-container">
      {/* HEADER CON LOGOUT */}
      <div className="scarichi-header">
        <h2>Nuovo Scarico</h2>
        <div>
          {role === "admin" && (
            <button onClick={goToDashboard} style={{ marginRight: "10px" }}>
              Torna alla Dashboard
            </button>
          )}
          <button onClick={logout}>🚪Logout ({auth.currentUser?.email || "sconosciuto"})</button>
        </div>
      </div>

      {/* TESTATA */}
      <div>
        {/* --- MODIFICA PUNTUALE: INPUT DATA/ORA TESTUALE + CHECKBOX --- */}
        <div style={{ display: "flex", gap: "12px", marginTop: "8px", alignItems: "center" }}>
          <label>
            Data:
            <input
              type="text"
              value={dataScaricoStr}
              placeholder="gg/mm/yyyy"
              onChange={handleDataInput}
              onBlur={handleDataBlur}
              style={{ width: "100px" }}
              disabled={usaOra}
            />
          </label>

          <label>
            Ora:
            <input
              type="text"
              value={oraStr}
              placeholder="hh:mm"
              onChange={handleOraInput}
              onBlur={handleOraBlur}
              style={{ width: "60px" }}
              disabled={usaOra}
            />
          </label>

          <label style={{ marginLeft: "12px" }}>
            <input type="checkbox" checked={usaOra} onChange={handleUsaOraChange} /> Adesso
          </label>
        </div>

        <label>Fornitore:</label>
        <select disabled={testataBloccata} value={selectedFornitore} onChange={(e) => setSelectedFornitore(e.target.value)}>
          <option value="">-- Seleziona --</option>
          {fornitori.map((f) => (
            <option key={f.id} value={f.nome}>
              {f.nome}
            </option>
          ))}
        </select>

        <label>Listino:</label>
        <select disabled={testataBloccata} value={selectedListino} onChange={(e) => setSelectedListino(e.target.value)}>
          <option value="">-- Seleziona --</option>
          {listini.map((l) => (
            <option key={l.id} value={l.nome}>
              {l.nome}
            </option>
          ))}
        </select>

        {testataBloccata && <button onClick={handleReset} style={{ marginLeft: "15px" }}>Reset Scarico</button>}
      </div>

      <hr />

      {/* CER */}
      {testataBloccata && (
        <>
          <label>Codice CER:</label>
          <select value={selectedCer} onChange={(e) => setSelectedCer(e.target.value)}>
            <option value="">-- Seleziona CER --</option>
            {cerDisponibili.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </>
      )}

      {/* MATERIALI */}
      {selectedCer && (
        <>
          <label>Materiale:</label>
          <select value={selectedMateriale} onChange={(e) => setSelectedMateriale(e.target.value)}>
            <option value="">-- Seleziona Materiale --</option>
            {materialiFiltrati.map((m) => (
              <option key={m.id} value={m.nome}>
                {m.nome}
              </option>
            ))}
          </select>

          <label>Peso (kg):</label>
          <input
            type="text"
            value={peso}
            onChange={(e) => {
              let val = e.target.value.replace(/[^0-9.,-]/g, "");
              if (parseFloat(val.replace(",", ".")) === 0) val = "";
              setPeso(val);
            }}
          />

          <label>Calo (kg):</label>
          <input type="text" value={calo} onChange={(e) => setCalo(e.target.value.replace(/[^0-9.,]/g, ""))} />

          <button onClick={handleAdd} disabled={!selectedMateriale || !peso || parseFloat(peso.replace(",", ".")) === 0}>
            Aggiungi / Aggiorna
          </button>
        </>
      )}

      <hr />

      {/* TABELLE CER */}
      {scarico.map((c) => (
        <div key={c.cer}>
          <h3>CER {c.cer}</h3>
          <table>
            <thead>
              <tr>
                <th>Materiale</th>
                <th>Peso</th>
                <th>Calo</th>
                <th>Netto</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {c.righe.map((r) => (
                <tr key={`${c.cer}-${r.materiale}`}>
                  <td>{r.materiale}</td>
                  <td>{r.peso}</td>
                  <td>{r.calo}</td>
                  <td>{r.netto}</td>
                  <td className="actions">
                    <button className="edit" onClick={() => handleEdit(c.cer, r.materiale)}>
                      Modifica
                    </button>
                    <button className="delete" onClick={() => handleDelete(c.cer, r.materiale)}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <strong>Totale CER: {c.totaleCer.toFixed(2)} kg</strong>
          <hr />
        </div>
      ))}

      {scarico.length > 0 && (
        <>
          <button onClick={handleSave}>Salva Scarico</button>
          <button onClick={handlePrint} style={{ marginLeft: "15px" }}>
            Stampa PDF
          </button>
        </>
      )}
    </div>
  );
};

export default Scarichi;