import { useState } from 'react'
import Landing from './Landing'
import GameEngine from './GameEngine'

function App() {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <>
      {isPlaying ? (
        <GameEngine />
      ) : (
        <Landing onStartScan={() => setIsPlaying(true)} />
      )}
    </>
  )
}

export default App
