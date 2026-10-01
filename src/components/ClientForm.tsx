"use client";
/* eslint-disable @next/next/no-img-element -- logos are local data URLs */

import { useRef, useState } from "react";
import { prepareImage, trimLogo } from "@/lib/image";
import { newId, saveClient } from "@/lib/store";
import type { Client, EnglishVariant } from "@/lib/types";

export function ClientLogo({ client, size = 54 }: { client: Client | undefined; size?: number }) {
  if (client?.logoDataUrl) {
    return <img className="client-logo" src={client.logoDataUrl} alt="" style={{ width: size, height: size }} />;
  }
  return (
    <div className="client-logo empty" style={{ width: size, height: size }}>
      {(client?.name ?? "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function ClientForm({
  client,
  onClose,
  onSaved,
}: {
  client?: Client;
  onClose: () => void;
  onSaved: (c: Client) => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [logo, setLogo] = useState(client?.logoDataUrl ?? "");
  const [english, setEnglish] = useState<EnglishVariant>(client?.english ?? "en-GB");
  const [description, setDescription] = useState(client?.description ?? "");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    try {
      // PNG keeps transparent logos transparent on the coloured cover box.
      const img = await prepareImage(file, 800, "image/png");
      setLogo((await trimLogo(img.dataUrl)).dataUrl);
    } catch {
      setError("Could not read that image.");
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("Enter the client name.");
      return;
    }
    const saved: Client = {
      id: client?.id ?? newId(),
      createdAt: client?.createdAt ?? Date.now(),
      name: name.trim(),
      logoDataUrl: logo,
      english,
      description: description.trim(),
    };
    await saveClient(saved);
    onSaved(saved);
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{client ? "Edit client" : "New client"}</h2>
        <label className="field">
          <span>Client / brand name (as shown on the cover)</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="field">
          <span>Logo</span>
          <div className="logo-drop">
            <ClientLogo client={{ name, logoDataUrl: logo } as Client} size={70} />
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              {logo ? "Change logo" : "Upload logo"}
            </button>
            {logo && (
              <button className="btn small ghost danger" onClick={() => setLogo("")}>
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
          </div>
        </div>
        <div className="field">
          <span>Report English</span>
          <div className="row">
            {(["en-GB", "en-US"] as const).map((v) => (
              <label key={v} className={`check${english === v ? " on" : ""}`}>
                <input type="radio" checked={english === v} onChange={() => setEnglish(v)} hidden />
                {v === "en-GB" ? "UK English (organisation)" : "US English (organization)"}
              </label>
            ))}
          </div>
        </div>
        <label className="field">
          <span>What the client does (helps Claude write relevant text)</span>
          <textarea
            className="textarea"
            value={description}
            placeholder="e.g. Child development and learning centre in Navi Mumbai offering speech therapy and assessments for parents."
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="row">
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save client
          </button>
        </div>
      </div>
    </div>
  );
}
