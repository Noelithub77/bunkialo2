"use client";

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import QRCode from "react-fancy-qrcode/dist/web";
import UpiIcon from "./upi-icon";

type UpiQrModalContentProps = {
  upiUrl: string;
};

export function UpiQrModalContent({ upiUrl }: UpiQrModalContentProps) {
  return (
    <DialogContent
      showCloseButton
      className="w-[min(92vw,420px)] rounded-3xl border border-white/10 bg-[#0a0a0c] p-5 text-white sm:p-6 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:rounded-lg [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-white/20 [&_[data-slot=dialog-close]]:bg-black/35 [&_[data-slot=dialog-close]]:text-white/70 [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:transition-colors [&_[data-slot=dialog-close]]:hover:bg-white/10 [&_[data-slot=dialog-close]]:hover:text-white"
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(90%_65%_at_10%_0%,rgba(255,171,0,0.12),transparent_58%),radial-gradient(80%_60%_at_100%_100%,rgba(255,171,0,0.06),transparent_62%)]" />
      <DialogHeader className="gap-2 text-left">
        <DialogTitle className="font-display text-2xl tracking-tight text-white">
          Support Bunkialo
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-white/72">
          Scan this UPI QR with your mobile payment app and donate.
        </DialogDescription>
      </DialogHeader>

      <div className="relative mt-1 rounded-3xl border border-white/12 bg-[#121214] p-4">
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(120%_70%_at_10%_0%,rgba(255,255,255,0.06),transparent_58%)]" />
        <div className="relative mx-auto w-fit overflow-hidden rounded-3xl bg-white p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
          <QRCode
            value={upiUrl}
            size={236}
            margin={12}
            errorCorrection="H"
            color="#111111"
            positionColor="#111111"
            positionRadius={[8, 5]}
            dotScale={0.92}
            dotRadius={1.5}
            backgroundColor="#FFFFFF"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-white p-3.5 shadow-lg ring-3 ring-[#FFAB00]/24 ring-offset-2 ring-offset-transparent">
              <UpiIcon className="size-10 text-black" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/60">UPI ID</p>
            <p className="font-mono text-sm font-medium text-white">
              noelmcv7@oksbi
            </p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText("noelmcv7@oksbi")}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
          >
            Copy
          </button>
        </div>
      </div>
    </DialogContent>
  );
}
