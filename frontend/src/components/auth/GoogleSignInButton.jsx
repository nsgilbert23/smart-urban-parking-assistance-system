import { useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SCRIPT_ID = "google-identity-services";

export default function GoogleSignInButton({ onCredential, disabled = false }) {
  const buttonRef = useRef(null);
  const credentialHandler = useRef(onCredential);
  credentialHandler.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return undefined;
    let active = true;
    const renderButton = () => {
      if (!active || !buttonRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) credentialHandler.current(response.credential);
        },
        auto_select: false,
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: Math.min(360, buttonRef.current.clientWidth || 320),
        logo_alignment: "left",
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      let script = document.getElementById(GOOGLE_SCRIPT_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = GOOGLE_SCRIPT_ID;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderButton, { once: true });
    }
    return () => { active = false; };
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-slate-700">Google sign-in</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Available after a Google OAuth client ID is configured.</p>
      </div>
    );
  }

  return <div ref={buttonRef} aria-disabled={disabled} className={disabled ? "pointer-events-none opacity-60" : "min-h-10 w-full"} />;
}
