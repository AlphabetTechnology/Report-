"use client";
/* eslint-disable @next/next/no-img-element -- logos are local data URLs */

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { prepareImage, trimLogo } from "@/lib/image";
import { newId, saveClient } from "@/lib/store";
import type { Client, EnglishVariant } from "@/lib/types";

export function ClientLogo({ client, size = 54 }: { client: Client | undefined; size?: number }) {
  if (client?.logoDataUrl) {
    return <img className="client-logo" src={client.logoDataUrl} alt="" style={{ width: size, height: size }} />;
  }
  return (
    <div className="client-logo empty" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {(client?.name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

export const ENGLISH_LABEL: Record<EnglishVariant, string> = {
  "en-GB": "🇬🇧 UK English",
  "en-US": "🇺🇸 US English",
};

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
        <div className="modal-head">
          <div className="ic">
            <Icon name="users" />
          </div>
          <div>
            <h2>{client ? "Edit client" : "Add a client"}</h2>
            <p>Name, logo and language are used on every report for this client.</p>
          </div>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>Client / brand name (as shown on the cover)</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="field">
            <span>Logo</span>
            <div className="logo-drop">
              <ClientLogo client={{ name, logoDataUrl: logo } as Client} size={72} />
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn small" onClick={() => fileRef.current?.click()}>
                    <Icon name="upload" size={15} />
                    {logo ? "Change logo" : "Upload logo"}
                  </button>
                  {logo && (
                    <button className="btn small ghost danger" onClick={() => setLogo("")}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  PNG with a transparent background looks best. Empty margins are trimmed automatically.
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickLogo(e.target.files?.[0])} />
            </div>
          </div>
          <div className="field">
            <span>Report language &amp; date style</span>
            <div className="row">
              {(["en-GB", "en-US"] as const).map((v) => (
                <label key={v} className={`check${english === v ? " on" : ""}`} style={{ flex: 1 }}>
                  <input type="radio" checked={english === v} onChange={() => setEnglish(v)} hidden />
                  <div>
                    <div>{ENGLISH_LABEL[v]}</div>
                    <div className="small muted">
                      {v === "en-GB" ? "organisation · 1 September 2026" : "organization · September 1, 2026"}
                    </div>
                  </div>
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
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            <Icon name="check" size={16} />
            Save client
          </button>
        </div>
      </div>
    </div>
  );
}
