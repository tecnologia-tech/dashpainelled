import { useRef, useEffect } from "react";

export default function VideoPlayer({ active, videoPath }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (active && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [active, videoPath]);

  return (
    <video
      ref={videoRef}
      src={videoPath}
      autoPlay
      muted
      loop
      playsInline
      className="video-player"
    />
  );
}
