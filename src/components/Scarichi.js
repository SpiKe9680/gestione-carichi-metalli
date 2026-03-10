// src/components/Scarichi.js

import React, { useEffect, useState } from "react";
import { db, auth, storage } from "../firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { scriviLog } from "../utils/log";
import "./Scarichi.css";

import DatePicker, { registerLocale } from "react-datepicker";
import { it } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("it", it);


const mesiItaliani = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

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
const [fotoFile, setFotoFile] = useState(null);


  const [usaOra, setUsaOra] = useState(true);
  const [dataScaricoStr, setDataScaricoStr] = useState("");
  const [oraStr, setOraStr] = useState("");


  const formattaDataItaliana = (date) => {
    const gg = String(date.getDate()).padStart(2, "0");
    const mese = mesiItaliani[date.getMonth()];
    const yyyy = date.getFullYear();
    return `${gg} ${mese} ${yyyy}`;
  };

  const formattaOra24 = (date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  useEffect(() => {
    const now = new Date();
    if (usaOra) {
      setDataScaricoStr(formattaDataItaliana(now));
      setOraStr(formattaOra24(now));
    }
  }, [usaOra]);

  const handleUsaOraChange = (e) => {
    const checked = e.target.checked;
    setUsaOra(checked);
    const now = new Date();
    if (checked) {
      setDataScaricoStr(formattaDataItaliana(now));
      setOraStr(formattaOra24(now));
    } else {
      setDataScaricoStr("");
      setOraStr("");
    }
  };

  const handleDataInput = (e) => setDataScaricoStr(e.target.value);

  const handleDataBlur = () => {
    const now = new Date();
    const [gg, meseStr, yyyy] = dataScaricoStr.split(" ");
    const mm = mesiItaliani.indexOf(meseStr);
    let giorno = Number(gg);
    let anno = Number(yyyy);
    if (mm < 0 || isNaN(giorno) || isNaN(anno)) {
      setDataScaricoStr(formattaDataItaliana(now));
      return;
    }
    let newDate = new Date(anno, mm, giorno);
    if (newDate > now) newDate = now;
    setDataScaricoStr(formattaDataItaliana(newDate));

    if (newDate.toDateString() === now.toDateString()) {
      const [hh, min] = oraStr.split(":").map(Number);
      if (hh > now.getHours() || (hh === now.getHours() && min > now.getMinutes())) {
        setOraStr(formattaOra24(now));
      }
    }
  };

  const handleOraInput = (e) => {
    let val = e.target.value.replace(/[^0-9:]/g, "").slice(0, 5);
    setOraStr(val);
  };

  const handleOraBlur = () => {
    const now = new Date();
    let [hh, min] = oraStr.split(":").map(Number);
    if (isNaN(hh)) hh = 0;
    if (isNaN(min)) min = 0;
    if (hh > 23) hh = 23;
    if (min > 59) min = 59;

    const [gg, meseStr, yyyy] = dataScaricoStr.split(" ");
    const mm = mesiItaliani.indexOf(meseStr);
    const inputDate = new Date(Number(yyyy), mm, Number(gg), hh, min);
    if (inputDate > now) setOraStr(formattaOra24(now));
    else setOraStr(`${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  };

  const parseDataOra = (dataStr, oraStr) => {
    if (!dataStr) return new Date();
    const [gg, meseStr, yyyy] = dataStr.split(" ");
    const mm = mesiItaliani.indexOf(meseStr);
    if (mm < 0) return new Date();
    const d = new Date(Number(yyyy), mm, Number(gg));
    if (oraStr) {
      const [hh, min] = oraStr.split(":").map(Number);
      if (!isNaN(hh) && !isNaN(min)) d.setHours(hh, min, 0, 0);
    }
    const now = new Date();
    if (d > now) return now;
    return d;
  };

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

  const cerDisponibili = [...new Set(materiali.map((m) => m.codiceCER).filter((c) => c))];
  const materialiFiltrati = selectedCer ? materiali.filter((m) => m.codiceCER === selectedCer) : [];
  useEffect(() => {
    if (materialiFiltrati.length === 1) setSelectedMateriale(materialiFiltrati[0].nome);
  }, [selectedCer, materialiFiltrati]);

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
            const newRighe =
              matIndex >= 0
                ? [...c.righe.slice(0, matIndex), { materiale: selectedMateriale, peso: pesoNum, calo: caloNum, netto }, ...c.righe.slice(matIndex + 1)]
                : [...c.righe, { materiale: selectedMateriale, peso: pesoNum, calo: caloNum, netto }];
            const totaleCer = newRighe.reduce((sum, r) => sum + r.netto, 0);
            return { ...c, righe: newRighe, totaleCer };
          }
          return c;
        });
        return updated;
      } else {
        return [...prev, { cer: selectedCer, righe: [{ materiale: selectedMateriale, peso: pesoNum, calo: caloNum, netto }], totaleCer: netto }];
      }
    });

    setPeso("");
    setCalo("");
    setSelectedMateriale("");
  };

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

  const handleDelete = (cer, materiale) => {
    setScarico((prev) =>
      prev
        .map((c) => {
          if (c.cer === cer) {
            const newRighe = c.righe.filter((r) => r.materiale !== materiale);
            const totaleCer = newRighe.reduce((sum, r) => sum + r.netto, 0);
            return { ...c, righe: newRighe, totaleCer };
          }
          return c;
        })
        .filter((c) => c.righe.length > 0)
    );
  };

  const handleReset = () => {
    setSelectedFornitore("");
    setSelectedListino("");
    setSelectedCer("");
    setSelectedMateriale("");
    setPeso("");
    setCalo("");
    setScarico([]);
    setFotoFile(null);
    setUsaOra(true);
    const now = new Date();
    setDataScaricoStr(formattaDataItaliana(now));
    setOraStr(formattaOra24(now));
  };

  const handleSave = async () => {
  if (!selectedFornitore || !selectedListino || scarico.length === 0) {
    alert("Seleziona fornitore, listino e almeno un materiale!");
    return;
  }

  if (!fotoFile) {
    alert("Devi allegare una foto dello scarico!");
    return;
  }

  try {
    const utente = auth.currentUser?.email || "sconosciuto";
    const dataFinale = usaOra ? serverTimestamp() : parseDataOra(dataScaricoStr, oraStr);

    // --- UPLOAD FOTO SU IMGBB ---
    const formData = new FormData();
    formData.append("image", fotoFile);

    const response = await fetch(
      "https://api.imgbb.com/1/upload?key=104a4faded51e531311077f0412b6a38",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    if (!data.success) throw new Error("Upload immagine fallito");

    const fotoURL = data.data.url; // URL immagine pronto

    // --- SALVATAGGIO DOCUMENTO SU FIRESTORE ---
    const docRef = await addDoc(collection(db, "scarichi"), {
      fornitore: selectedFornitore,
      listino: selectedListino,
      scarico,
      utente,
      data: dataFinale,
      fotoURL,
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
        fotoURL,
      },
    });

    alert("Scarico salvato correttamente!");
    handleReset();
  } catch (err) {
    console.error("Errore salvataggio scarico:", err);
    alert("Errore salvataggio scarico, vedi console");
  }
};

  const handlePrint = () => {
  if (!selectedFornitore || !selectedListino || scarico.length === 0) {
    alert("Niente da stampare!");
    return;
  }

  if (!fotoFile) {
    alert("Devi allegare la foto per stampare il PDF!");
    return;
  }

  const doc = new jsPDF();
  doc.setFontSize(16);

  // Intestazione: Data e Ora, Fornitore, Listino
  doc.text(`Data e Ora: ${dataScaricoStr} ${oraStr}`, 10, 10);
  doc.text(`Fornitore: ${selectedFornitore}`, 10, 20);
  doc.text(`Listino: ${selectedListino}`, 10, 30);

  let y = 40;

  // Tabella scarico
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

  // Inserimento foto in basso
  const reader = new FileReader();
  reader.onload = function (e) {
    const imgData = e.target.result;
    let imgY = y + 10;
    doc.addImage(imgData, "JPEG", 10, imgY, 50, 50); // larghezza 50mm, altezza 50mm
    doc.text(`Ora foto: ${oraStr}`, 10, imgY + 55);
    doc.save(`Scarico_${selectedFornitore}_${selectedListino}.pdf`);
  };
  reader.readAsDataURL(fotoFile);
};

  const testataBloccata = selectedFornitore && selectedListino;

  return (
    <div className="scarichi-container">
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

      <div>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px", alignItems: "center" }}>
          <label>
            Data:
            <DatePicker
              selected={dataScaricoStr ? parseDataOra(dataScaricoStr, oraStr) : new Date()}
              onChange={(date) => {
                setDataScaricoStr(formattaDataItaliana(date));
                if (formattaDataItaliana(date) === formattaDataItaliana(new Date())) {
                  const now = new Date();
                  const [hh, mm] = oraStr.split(":").map(Number);
                  if (hh > now.getHours() || (hh === now.getHours() && mm > now.getMinutes())) {
                    setOraStr(formattaOra24(now));
                  }
                } else {
                  setOraStr("00:00");
                }
              }}
              dateFormat="dd MMM yyyy"
              locale="it"
              disabled={usaOra}
              placeholderText="DD MMM YYYY"
            />
          </label>

          <label>
            Ora:
            <DatePicker
              selected={
                oraStr
                  ? new Date(0, 0, 0, ...oraStr.split(":").map(Number))
                  : new Date()
              }
              onChange={(time) => setOraStr(formattaOra24(time))}
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={15}
              timeFormat="HH:mm"
              dateFormat="HH:mm"
              disabled={usaOra}
              placeholderText="HH:mm"
              minTime={new Date(0, 0, 0, 0, 0)}
              maxTime={
                dataScaricoStr === formattaDataItaliana(new Date())
                  ? new Date(0, 0, 0, new Date().getHours(), new Date().getMinutes())
                  : new Date(0, 0, 0, 23, 59)
              }
            />
          </label>

          <label style={{ marginLeft: "12px" }}>
            <input type="checkbox" checked={usaOra} onChange={handleUsaOraChange} /> Adesso
          </label>
        </div>

        <label>Fornitore:</label>
        <select
  disabled={testataBloccata}
  value={selectedFornitore}
  onChange={(e) => {
    const nome = e.target.value;
    setSelectedFornitore(nome);
    const forn = fornitori.find((f) => f.nome === nome);
    if (!forn) return;

    if (forn.predefListino) {
      const listinoObj = listini.find((l) => l.id === forn.predefListino);
      if (listinoObj) {
        setSelectedListino(listinoObj.nome);
        return;
      }
    }

    const listiniPredefiniti = fornitori.map((f) => f.predefListino).filter((id) => id);
    const primoListinoLibero = listini.find((l) => !listiniPredefiniti.includes(l.id));
    if (primoListinoLibero) setSelectedListino(primoListinoLibero.nome);
    else setSelectedListino("");
  }}
>
  <option value="">-- Seleziona --</option>
  {fornitori.map((f) => (
    <option key={f.id} value={f.nome}>{f.nome}</option>
  ))}
</select>

        <label>Listino:</label>
        <select
          disabled={testataBloccata || role !== "admin"}
          value={selectedListino}
          onChange={(e) => setSelectedListino(e.target.value)}
        >
          <option value="">-- Seleziona --</option>
          {listini.map((l) => (
            <option key={l.id} value={l.nome}>{l.nome}</option>
          ))}
        </select>

        {testataBloccata && <button onClick={handleReset} style={{ marginLeft: "15px" }}>Reset Scarico</button>}

        {testataBloccata && (
          <>
           <label>Foto scarico:</label>
<input
  type="file"
  accept="image/*"
  onChange={(e) => setFotoFile(e.target.files[0])}
/>
          </>
        )}
      </div>

      <hr />

      {testataBloccata && (
        <>
          <label>Codice CER:</label>
          <select value={selectedCer} onChange={(e) => setSelectedCer(e.target.value)}>
            <option value="">-- Seleziona CER --</option>
            {cerDisponibili.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </>
      )}

      {selectedCer && (
        <>
          <label>Materiale:</label>
          <select value={selectedMateriale} onChange={(e) => setSelectedMateriale(e.target.value)}>
            <option value="">-- Seleziona Materiale --</option>
            {materialiFiltrati.map((m) => (
              <option key={m.id} value={m.nome}>{m.nome}</option>
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
                    <button className="edit" onClick={() => handleEdit(c.cer, r.materiale)}>Modifica</button>
                    <button className="delete" onClick={() => handleDelete(c.cer, r.materiale)}>Elimina</button>
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
    <button
      onClick={handlePrint}
      style={{ marginLeft: "15px" }}
      disabled={!fotoFile} // <-- attivo solo se caricata foto
    >
      Stampa PDF
    </button>
  </>
)}
    </div>
  );
};

export default Scarichi;