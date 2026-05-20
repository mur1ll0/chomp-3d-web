import Peer from 'peerjs';
console.log('Peer in worker:', typeof Peer);
self.onmessage = () => {
  console.log('Worker message received');
}
