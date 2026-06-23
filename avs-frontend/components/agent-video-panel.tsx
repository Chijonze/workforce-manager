"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AudioPresets,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalTracks,
} from "livekit-client";
import { Button } from "@/components/ui/button";

export function AgentVideoPanel() {
  const searchParams = useSearchParams();
  const roomName = searchParams.get("room") || "";
  const mode = searchParams.get("mode") === "voice" ? "voice" : "video";
  const [status, setStatus] = useState(roomName ? "Ready to join" : "Missing room");
  const [room, setRoom] = useState<Room | null>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      void room?.disconnect();
    };
  }, [room]);

  async function joinCall() {
    if (!roomName) return;
    setStatus("Requesting camera and microphone...");

    try {
      const tokenResponse = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomName,
          role: "agent",
          mode,
          identity: `agent-${crypto.randomUUID()}`,
          displayName: "AVS Agent",
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
        setStatus(`${participant.name || "Customer"} joined`);
      });
      nextRoom.on(RoomEvent.Disconnected, () => setStatus("Call ended"));

      const tracks = await createLocalTracks({
        audio: true,
        video: mode === "video" ? { resolution: VideoPresets.h360.resolution } : false,
      });
      const localVideo = tracks.find((track) => track.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
      if (localVideo && localVideoRef.current) localVideoRef.current.replaceChildren(localVideo.attach());

      await nextRoom.connect(tokenData.url, tokenData.token);
      await Promise.all(tracks.map((track) => nextRoom.localParticipant.publishTrack(track)));

      setRoom(nextRoom);
      setStatus(mode === "voice" ? "Connected to voice call" : "Connected");
    } catch (error) {
      console.error(error);
      setStatus("Could not join video call");
    }
  }

  function handleRemoteTrack(track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) {
    if (track.kind === Track.Kind.Audio) {
      track.attach();
      setStatus(`${participant.name || "Customer"} is on voice`);
      return;
    }
    if (track.kind !== Track.Kind.Video || !remoteVideoRef.current) return;
    remoteVideoRef.current.replaceChildren(track.attach());
    setStatus(`${participant.name || "Customer"} is on video`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-3 text-white">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold">AVS {mode} call</h1>
          <p className="text-xs text-slate-300">{status}</p>
        </div>
        <Button type="button" size="sm" onClick={joinCall} disabled={!roomName || Boolean(room)}>
          Join
        </Button>
      </div>
      <div className="grid gap-3">
        <div ref={remoteVideoRef} className="aspect-video overflow-hidden rounded-md bg-slate-900" />
        <div ref={localVideoRef} className="aspect-video overflow-hidden rounded-md bg-slate-800" />
      </div>
    </main>
  );
}
