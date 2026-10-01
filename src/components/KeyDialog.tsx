"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { DIRECT_AI, getApiKey, NEED_KEY_EVENT, setApiKey } from "@/lib/api";

/**
 * On the static (GitHub Pages) build each person adds their own Anthropic key.
 * It is stored only in this browser and sent only to api.anthropic.com.
 */
export default function KeyDialog() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");

  useEffect(() => {
    if (!DIRECT_AI) return;
    const show = () => {
      setKey(getApiKey());
      setOpen(true);
    };
    window.addEventListener(NEED_KEY_EVENT, show);
    return () => window.removeEventListener(NEED_KEY_EVENT, show);
  }, []);

  if (!open) return null;

  const save = () => {
    setApiKey(key.trim());
    setOpen(false);
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal">
        <div className="modal-head">
          <div className="ic">
            <Icon name="lock" />
          </div>
          <div>
            <h2>Anthropic API key</h2>
            <p>Needed for reading screenshots, writing and proofreading.</p>
          </div>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>API key</span>
            <input
              className="input"
              type="password"
              placeholder="sk-ant-…"
              value={key}
              autoFocus
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </label>
          <div className="notice">
            <Icon name="lock" size={16} />
            <span>
              The key is saved only in this browser and is sent only to Anthropic. Create one at{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>
              . Use a key with a spending limit, and don&apos;t add it on shared computers.
            </span>
          </div>
        </div>
        <div className="modal-foot">
          {getApiKey() && (
            <button
              className="btn ghost danger"
              onClick={() => {
                setApiKey("");
                setKey("");
              }}
            >
              Remove key
            </button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!key.trim()} onClick={save}>
            <Icon name="check" size={16} />
            Save key
          </button>
        </div>
      </div>
    </div>
  );
}
