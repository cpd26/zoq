import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import SimplePeer from 'simple-peer';

export default function VideoCall({ user, recipientId, recipientName, socket, onEnd, callType }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const [callStatus, setCallStatus] = useState('Connecting...');

  useEffect(() => {
    initializeCall();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('ice_candidate', handleIceCandidate);

    return () => {
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('ice_candidate');
    };
  }, [socket]);

  const initializeCall = async () => {
    try {
      const constraints = {
        audio: true,
        video: callType === 'video' ? { width: 1280, height: 720 } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection as initiator
      createPeer(stream, true);
      setCallStatus('Calling...');
    } catch (error) {
      console.error('Failed to get media stream:', error);
      setCallStatus('Failed to access camera/microphone');
    }
  };

  const createPeer = (stream, initiator) => {
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream
    });

    peer.on('signal', (signal) => {
      if (socket) {
        socket.emit('call_user', {
          to_user_id: recipientId,
          signal,
          type: initiator ? 'offer' : 'answer'
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      setCallStatus('Connected');
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setCallStatus('Connection error');
    });

    peer.on('close', () => {
      endCall();
    });

    peerRef.current = peer;
  };

  const handleIncomingCall = ({ signal, from_user_id }) => {
    if (from_user_id === recipientId && peerRef.current) {
      peerRef.current.signal(signal);
    }
  };

  const handleCallAccepted = ({ signal }) => {
    if (peerRef.current) {
      peerRef.current.signal(signal);
    }
  };

  const handleIceCandidate = ({ candidate }) => {
    if (peerRef.current && candidate) {
      peerRef.current.signal(candidate);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
  };

  const endCall = () => {
    cleanup();
    onEnd();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black" data-testid="video-call-container">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
          <div className="text-center text-white">
            <h2 className="text-2xl font-bold">{recipientName}</h2>
            <p className="text-sm opacity-80">{callStatus}</p>
          </div>
        </div>

        {/* Video Container */}
        <div className="flex-1 relative">
          {/* Remote Video */}
          <div className="w-full h-full bg-gray-900">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                data-testid="remote-video"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mx-auto mb-4 flex items-center justify-center">
                    <span className="text-5xl">{recipientName?.[0]?.toUpperCase()}</span>
                  </div>
                  <p className="text-lg">{callStatus}</p>
                </div>
              </div>
            )}
          </div>

          {/* Local Video */}
          {callType === 'video' && localStream && (
            <div className="absolute bottom-24 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-white shadow-2xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                data-testid="local-video"
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 bg-gradient-to-t from-black/80 to-transparent absolute bottom-0 left-0 right-0">
          <div className="flex justify-center gap-4">
            <Button
              data-testid="toggle-mute-button"
              size="lg"
              variant="secondary"
              className="rounded-full w-14 h-14"
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>

            {callType === 'video' && (
              <Button
                data-testid="toggle-video-button"
                size="lg"
                variant="secondary"
                className="rounded-full w-14 h-14"
                onClick={toggleVideo}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </Button>
            )}

            <Button
              data-testid="end-call-button"
              size="lg"
              variant="destructive"
              className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700"
              onClick={endCall}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}