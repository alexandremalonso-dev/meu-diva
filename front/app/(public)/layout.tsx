"use client";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import Script from "next/script";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ChatProvider>
        {children}
        {/* 🔥 Widget de autoatendimento — Huggy.chat (mesmo widget do site institucional) */}
        <Script id="huggy-chat-widget" strategy="afterInteractive">
          {`
            var $_Huggy = { defaultCountry: '+55', uuid: 'bb16ba4e-9ae7-45df-aaeb-1366fc78b1b8', company: '328310' };
            (function(i,s,o,g,r,a,m){
              i[r]={context:{id:'1f67d9e29497fcb5b865e6c4c4cc64bf'}};
              a=o;o=s.createElement(o);
              o.async=1;o.src=g;
              m=s.getElementsByTagName(a)[0];
              m.parentNode.insertBefore(o,m);
            })(window,document,'script','https://js.huggy.chat/widget.min.js','pwz');
          `}
        </Script>
      </ChatProvider>
    </AuthProvider>
  );
}
