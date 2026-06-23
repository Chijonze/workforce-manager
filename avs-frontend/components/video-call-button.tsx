"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneCall, Video, X } from "lucide-react";
import {
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  AudioPresets,
  VideoPresets,
  createLocalTracks,
} from "livekit-client";
import { Button, type ButtonProps } from "@/components/ui/button";

type VideoCallButtonProps = ButtonProps & {
  children?: React.ReactNode;
  iconSize?: number;
};

export function VideoCallButton({ children = "Video call", iconSize = 18, asChild: _asChild, ...props }: VideoCallButtonProps) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [room, setRoom] = useState<Room | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      void room?.disconnect();
    };
  }, [room]);

  async function startCall() {
    setChooserOpen(false);
    setOpen(true);
    setStatus("Requesting camera and microphone...");

    try {
      const roomName = `avs-${crypto.randomUUID()}`;
      const identity = `customer-${crypto.randomUUID()}`;
      const tokenResponse = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomName,
          identity,
          role: "customer",
          displayName: "Website visitor",
          pageUrl: window.location.href,
        }),
      });

      if (!tokenResponse.ok) throw new Error("Token request failed");
      const tokenData = await tokenResponse.json();

      const nextRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoCodec: "vp8",
          videoEncoding: VideoPresets.h360.encoding,
          audioPreset: AudioPresets.speech,
          dtx: true,
          red: false,
        },
      });

      nextRoom.on(RoomEvent.TrackSubscribed, handleRemoteTrack);
      nextRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        setStatus(`${participant.name || "Agent"} joined`);
      });
      nextRoom.on(RoomEvent.Disconnected, () => setStatus("Call ended"));

      const tracks = await createLocalTracks({ audio: true, video: { resolution: VideoPresets.h360.resolution } });
      const localVideo = tracks.find((track) => track.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
      if (localVideo && localVideoRef.current) {
        localVideoRef.current.replaceChildren(localVideo.attach());
      }

      await nextRoom.connect(tokenData.url, tokenData.token);
      await Promise.all(tracks.map((track) => nextRoom.localParticipant.publishTrack(track)));

      setRoom(nextRoom);
      setStatus("Waiting for an AVS agent...");
    } catch (error) {
      console.error(error);
      setStatus("Could not start video call. Please try chat or phone.");
    }
  }

  async function requestVoiceCall() {
    setChooserOpen(false);
    setOpen(true);
    setStatus("Requesting microphone...");
    try {
      const roomName = `voice-${crypto.randomUUID()}`;
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomName,
          identity: `voice-${crypto.randomUUID()}`,
          role: "customer",
          mode: "voice",
          displayName: "Website voice caller",
          pageUrl: window.location.href,
        }),
      });

      if (!response.ok) throw new Error("Voice request failed");
      const tokenData = await response.json();
      const nextRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          audioPreset: AudioPresets.speech,
          dtx: true,
          red: false,
        },
      });

      nextRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        setStatus(`${participant.name || "Agent"} joined voice`);
      });
      nextRoom.on(RoomEvent.Disconnected, () => setStatus("Call ended"));

      const tracks = await createLocalTracks({ audio: true, video: false });
      await nextRoom.connect(tokenData.url, tokenData.token);
      await Promise.all(tracks.map((track) => nextRoom.localParticipant.publishTrack(track)));
      setRoom(nextRoom);
      setStatus("Voice request sent. Waiting for an AVS agent...");
    } catch (error) {
      console.error(error);
      setStatus("Could not send voice request. Please try chat.");
    }
  }

  function handleRemoteTrack(track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) {
    if (track.kind !== Track.Kind.Video || !remoteVideoRef.current) return;
    remoteVideoRef.current.replaceChildren(track.attach());
    setStatus(`${participant.name || "Agent"} is on video`);
  }

  function endCall() {
    room?.disconnect();
    setRoom(null);
    setOpen(false);
    localVideoRef.current?.replaceChildren();
    remoteVideoRef.current?.replaceChildren();
  }

  return (
    <>
      <Button type="button" onClick={() => setChooserOpen(true)} {...props}>
        <PhoneCall size={iconSize} />
        {children}
      </Button>

      {chooserOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-950">Choose call type</p>
                <p className="text-xs text-slate-500">Connect with an AVS agent through Chatwoot.</p>
              </div>
              <button
                type="button"
                onClick={() => setChooserOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Close call options"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={requestVoiceCall}
                className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700"
              >
                <PhoneCall size={18} />
                Voice call
              </button>
              <button
                type="button"
                onClick={startCall}
                className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800"
              >
                <Video size={18} />
                Video call
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-950">AVS live video</p>
                <p className="text-xs text-slate-500">{status}</p>
              </div>
              <button
                type="button"
                onClick={endCall}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="End video call"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 bg-slate-950 p-3 sm:grid-cols-[1fr_220px]">
              <div ref={remoteVideoRef} className="aspect-video min-h-48 overflow-hidden rounded-md bg-slate-900 text-white" />
              <div ref={localVideoRef} className="aspect-video overflow-hidden rounded-md bg-slate-800 text-white" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
