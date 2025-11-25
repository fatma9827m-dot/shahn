import { QuizRoom } from '../../types';
import { 
    initQuizLobby, 
    showCreateRoomModal, 
    handleCreateRoomSubmit, 
    showJoinPrivateRoomModal, 
    handleJoinPrivateRoom, 
    handleQuickJoin, 
    showSubmitQuestionModal, 
    listenForLobbyRooms,
} from './lobby';
import { getCommunityQuestions, generateQuizQuestionsWithAI } from './questions';
import { listenForRoomChat, handleRoomChatSubmit } from './chat';
import { joinQuizRoom, enterQuizRoomView, handleUnexpectedRoomClosure, handleLeaveRoom } from './game-state';
import { renderQuizWaitingRoom, renderQuizStarting, renderQuizPlaying, renderAnswerReveal, renderInterstitial, renderFinished, renderSpectatorView } from './game-render';
import { handlePlayerReady, handleStartGame, handleAnswerSubmit, handleReportQuestion, handleUsePowerup, handleVoteCategory, handleRematch, handleShareResults } from './game-actions';
import { handleEmojiReact, showInviteFriendsModal, sendRoomInvitation, showEditRoomModal, handleEditRoomSubmit, showPlayerActionMenu, showHostManagePlayerModal, triggerInteractionAnimation, showInteractionModal, sendInteraction, handleKickPlayer } from './game-interactions';


// The state is managed through the single object instance created here.
export const quizFunctions: {
    currentQuizRoom: QuizRoom | null;
    [key: string]: any;
} = {
    currentQuizRoom: null,

    // from lobby.ts
    initQuizLobby,
    showCreateRoomModal,
    handleCreateRoomSubmit,
    showJoinPrivateRoomModal,
    handleJoinPrivateRoom,
    handleQuickJoin,
    showSubmitQuestionModal,
    listenForLobbyRooms,

    // from questions.ts
    getCommunityQuestions,
    generateQuizQuestionsWithAI,
    
    // from chat.ts
    listenForRoomChat,
    handleRoomChatSubmit,
    
    // from game-state.ts
    joinQuizRoom,
    enterQuizRoomView,
    handleUnexpectedRoomClosure,
    handleLeaveRoom,

    // from game-render.ts
    renderQuizWaitingRoom,
    renderQuizStarting,
    renderQuizPlaying,
    renderAnswerReveal,
    renderInterstitial,
    renderFinished,
    renderSpectatorView,

    // from game-actions.ts
    handlePlayerReady,
    handleStartGame,
    handleAnswerSubmit,
    handleReportQuestion,
    handleUsePowerup,
    handleVoteCategory,
    handleRematch,
    handleShareResults,

    // from game-interactions.ts
    handleEmojiReact,
    showInviteFriendsModal,
    sendRoomInvitation,
    showEditRoomModal,
    handleEditRoomSubmit,
    showPlayerActionMenu,
    showHostManagePlayerModal,
    triggerInteractionAnimation,
    showInteractionModal,
    sendInteraction,
    handleKickPlayer,
};

// Bind all methods to the quizFunctions object to ensure `this` context is correct
for (const key of Object.keys(quizFunctions)) {
    if (typeof (quizFunctions as any)[key] === 'function') {
        (quizFunctions as any)[key] = (quizFunctions as any)[key].bind(quizFunctions);
    }
}