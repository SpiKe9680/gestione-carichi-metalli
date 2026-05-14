import React, { useState, useMemo } from "react";
import { FixedSizeList as List } from "react-window";

const DropdownVirtualizzato = ({ items, value, onChange, placeholder }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // 🔥 filtro leggero
  const filtered = useMemo(() => {
    if (!search) return items;
    return items.filter(i =>
      i.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  // 🔥 riga virtualizzata
  const Row = ({ index, style }) => {
    const item = filtered[index];

    return (
      <div
        style={{
          ...style,
          padding: "5px",
          cursor: "pointer",
          background: item === value ? "#ddd" : "#fff"
        }}
        onClick={() => {
          onChange(item);
          setOpen(false);
        }}
      >
        {item}
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: 250 }}>
      
      {/* INPUT */}
      <input
        value={value || ""}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value); // opzionale: puoi anche NON aggiornare qui
        }}
        style={{ width: "100%", padding: 5 }}
      />

      {/* DROPDOWN */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: "100%",
            height: 200,
            border: "1px solid #ccc",
            background: "#fff",
            zIndex: 1000
          }}
        >
          <List
            height={200}
            itemCount={filtered.length}
            itemSize={35}
            width={"100%"}
          >
            {Row}
          </List>
        </div>
      )}
    </div>
  );
};

export default DropdownVirtualizzato;