import { createContext, useContext, useReducer } from "react";

export const GAME_PHASES = {
  INTRO: "intro",
  COUNTDOWN: "countdown",
  PROCESSING_SPEED: "processing_speed",
  WORKING_MEMORY: "working_memory",
  SPATIAL_MEMORY: "spatial_memory",
  RESULTS: "results",
};

export const GAME_ACTIONS = {
  START_SCAN: "START_SCAN",
  COUNTDOWN_COMPLETE: "COUNTDOWN_COMPLETE",
  GAME_COMPLETE: "GAME_COMPLETE",
  RESET: "RESET",
};

const initialState = {
  phase: GAME_PHASES.INTRO,
  scores: {
    speed: null,
    memory: null,
    spatial: null,
  },
  startedAt: null,
};

const GameContext = createContext(null);

const getNextPhase = (phase) => {
  if (phase === GAME_PHASES.PROCESSING_SPEED) return GAME_PHASES.WORKING_MEMORY;
  if (phase === GAME_PHASES.WORKING_MEMORY) return GAME_PHASES.SPATIAL_MEMORY;
  if (phase === GAME_PHASES.SPATIAL_MEMORY) return GAME_PHASES.RESULTS;
  return phase;
};

const applyGameScore = (scores, gameName, score) => {
  if (gameName === GAME_PHASES.PROCESSING_SPEED) {
    return { ...scores, speed: score };
  }
  if (gameName === GAME_PHASES.WORKING_MEMORY) {
    return { ...scores, memory: score };
  }
  if (gameName === GAME_PHASES.SPATIAL_MEMORY) {
    return { ...scores, spatial: score };
  }
  return scores;
};

/**
 * @typedef {Object} GameAction
 * @property {keyof typeof GAME_ACTIONS} type
 * @property {Record<string, any>} [payload]
 */
export const gameReducer = (state, action) => {
  switch (action.type) {
    case GAME_ACTIONS.START_SCAN:
      return {
        ...state,
        phase: GAME_PHASES.COUNTDOWN,
        startedAt: action.payload?.startedAt ?? state.startedAt,
      };
    case GAME_ACTIONS.COUNTDOWN_COMPLETE:
      return {
        ...state,
        phase: GAME_PHASES.PROCESSING_SPEED,
      };
    case GAME_ACTIONS.GAME_COMPLETE: {
      const { gameName, score } = action.payload ?? {};
      if (!gameName || !score) {
        throw new Error("GAME_COMPLETE requires payload.gameName and payload.score");
      }
      return {
        ...state,
        scores: applyGameScore(state.scores, gameName, score),
        phase: getNextPhase(gameName),
      };
    }
    case GAME_ACTIONS.RESET:
      return initialState;
    default:
      return state;
  }
};

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within GameProvider");
  }
  return context;
};
