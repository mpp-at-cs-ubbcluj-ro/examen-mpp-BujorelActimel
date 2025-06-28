import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

export default function Trivia() {
  const [alias, setAlias] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [score, setScore] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [message, setMessage] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [easyQuestions, setEasyQuestions] = useState([]);
  const [mediumQuestions, setMediumQuestions] = useState([]);
  const [hardQuestions, setHardQuestions] = useState([]);
  const [stage, setStage] = useState(1); // 1: usor, 2: mediu, 3: greu
  const [answered, setAnswered] = useState(0);
  const [answeredCorrect, setAnsweredCorrect] = useState(false);

  useEffect(() => {
    const interval = setInterval(fetchLeaderboard, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Eroare la incarcarea clasamentului');
    }
  };

  const startGame = async () => {
    if (!alias.trim()) {
      setMessage('Introduceti un alias!');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: alias.trim() })
      });
      const data = await response.json();
      if (response.ok) {
        setGameId(data.gameId);
        setGameStarted(true);
        setScore(0);
        setGameFinished(false);
        setMessage(data.message);
        setEasyQuestions(data.easyQuestions || []);
        setMediumQuestions(data.mediumQuestions || []);
        setHardQuestions(data.hardQuestions || []);
        setStage(1);
        setAnswered(0);
        setAnsweredCorrect(false);
        const easyQs = data.easyQuestions || [];
        if (easyQs.length > 0) {
          const randomIdx = Math.floor(Math.random() * easyQs.length);
          setCurrentQuestion(easyQs[randomIdx]);
        } else {
          setCurrentQuestion(null);
        }
        fetchLeaderboard();
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Eroare la inceperea jocului');
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentQuestion) {
      setMessage('Introduceti un raspuns!');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          questionId: currentQuestion.id,
          answer: userAnswer.trim()
        })
      });
      const data = await response.json();
      if (response.ok) {
        let delta = data.correct ? 4*stage*stage : -2;
        let newScore = score + delta;
        setScore(newScore);
        setMessage(data.correct ? `✔️ Corect! +${4*stage*stage} puncte` : '❌ Greșit! -2 puncte');
        setUserAnswer('');
        let newAnswered = answered + 1;
        setAnswered(newAnswered);
        let newAnsweredCorrect = answeredCorrect + (data.correct ? 1 : 0);
        setAnsweredCorrect(newAnsweredCorrect);
        let nextList = [];
        if (stage === 1) {
          nextList = easyQuestions.filter(q => q.id !== currentQuestion.id);
          setEasyQuestions(nextList);
        } else if (stage === 2) {
          nextList = mediumQuestions.filter(q => q.id !== currentQuestion.id);
          setMediumQuestions(nextList);
        } else {
          nextList = hardQuestions.filter(q => q.id !== currentQuestion.id);
          setHardQuestions(nextList);
        }
        let nextStage = stage;
        if (newAnsweredCorrect >= 2) {
          nextStage = stage + 1;
          setStage(nextStage);
          setAnswered(0);
          setAnsweredCorrect(0);
        }
        let available = [];
        if (nextStage === 1) 
          available = nextList;
        else if (nextStage === 2) 
          available = mediumQuestions.filter(q => q.id !== currentQuestion.id);
        else if (nextStage === 3) 
          available = hardQuestions.filter(q => q.id !== currentQuestion.id);
        if (nextStage > 3 || available.length === 0) {
          setGameFinished(true);
          setCurrentQuestion(null);
          setMessage(`Joc terminat! Scor final: ${newScore}`);
        } else {
          const randomIdx = Math.floor(Math.random() * available.length);
          setCurrentQuestion(available[randomIdx]);
        }
        fetchLeaderboard();
      } else {
        setMessage(data.error);
      }
    } catch (error) {
      setMessage('Eroare la trimiterea raspunsului');
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameId(null);
    setScore(0);
    setGameFinished(false);
    setMessage('');
    setAlias('');
    setCurrentQuestion(null);
    setEasyQuestions([]);
    setMediumQuestions([]);
    setHardQuestions([]);
    setStage(1);
    setAnswered(0);
    setAnsweredCorrect(false);
    setUserAnswer('');
  };

  const renderQuestion = () => {
    if (!currentQuestion) return <div style={{textAlign: 'center'}}>Nu exista intrebare de afișat.</div>;
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>{currentQuestion.question}</h2>
        <input
          type="text"
          value={userAnswer}
          onChange={e => setUserAnswer(e.target.value)}
          placeholder="Raspunsul tau"
          style={{
            padding: '10px',
            fontSize: '16px',
            border: '2px solid #ddd',
            borderRadius: '4px',
            width: '60%',
            marginBottom: '15px'
          }}
          onKeyPress={e => e.key === 'Enter' && handleSubmitAnswer()}
        />
        <br />
        <button
          onClick={handleSubmitAnswer}
          style={{
            padding: '10px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          Trimite raspunsul
        </button>
      </div>
    );
  };

  const renderLeaderboard = () => {
    const finishedGames = leaderboard.filter(game => game.finished || game.questions_answered >= 6 || (game.answers && game.answers.length >= 6));
    return (
      <div style={{ 
        marginLeft: '20px', 
        minWidth: '300px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        backgroundColor: '#f9f9f9'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Clasament Jocuri Terminate</h3>
        <div style={{ 
          maxHeight: '300px', 
          overflowY: 'auto',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          {finishedGames.length === 0 ? (
            <p style={{ padding: '15px', textAlign: 'center', color: '#666', margin: 0 }}>
              Nu exista jocuri terminate
            </p>
          ) : (
            finishedGames.map((game, index) => (
              <div 
                key={index} 
                style={{ 
                  padding: '10px',
                  borderBottom: index < finishedGames.length - 1 ? '1px solid #eee' : 'none',
                  backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#333' }}>{game.player_alias}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  inceput: {new Date(game.start_time).toLocaleString()}
                </div>
                <div style={{ fontSize: '14px', color: '#555' }}>Scor: {game.score ?? game.totalScore}</div>
                <div style={{ fontSize: '14px', color: '#555' }}>
                  intrebari raspunse: {game.questions_answered ?? game.answers?.length ?? 0}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>
        Trivia
      </h1>
      {!gameStarted ? (
        <div style={{ 
          textAlign: 'center', 
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          maxWidth: '500px',
          margin: '0 auto',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '16px', fontWeight: 'bold' }}>
              Introduceti alias-ul: 
              <input 
                type="text" 
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                style={{ 
                  marginLeft: '10px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  outline: 'none'
                }}
                placeholder="ex: player1, player2, admin"
                onKeyPress={(e) => e.key === 'Enter' && startGame()}
              />
            </label>
          </div>
          <button 
            onClick={startGame}
            style={{ 
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            incepe Trivia
          </button>
          <div style={{ 
            marginTop: '15px', 
            fontSize: '12px', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            💡 Aliasuri disponibile: player1, player2, admin
          </div>
        </div>
      ) : (
        <div>
          <div style={{ 
            textAlign: 'center', 
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>
              👤 {alias} | 🎯 Scor: {score}
            </h3>
            <button 
              onClick={resetGame}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔄 Joc Nou
            </button>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-start',
            gap: '20px',
            flexWrap: 'wrap'
          }}>
            <div style={{ 
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ textAlign: 'center', margin: '0 0 15px 0', color: '#333' }}>
                intrebare
              </h3>
              <div>
                {renderQuestion()}
              </div>
              {gameFinished && (
                <div style={{ 
                  marginTop: '20px',
                  padding: '15px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                    🎉 Joc Terminat!
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '5px' }}>
                    Scor final: {score}
                  </div>
                </div>
              )}
            </div>
            {renderLeaderboard()}
          </div>
        </div>
      )}
      {message && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '20px', 
          padding: '12px', 
          borderRadius: '6px',
          backgroundColor: message.includes('Eroare') || message.includes('nu exista') ? '#FFE0E0' : '#E8F5E8',
          border: `2px solid ${message.includes('Eroare') || message.includes('nu exista') ? '#FF6B6B' : '#4CAF50'}`,
          color: message.includes('Eroare') || message.includes('nu exista') ? '#d32f2f' : '#2e7d32',
          fontWeight: 'bold',
          maxWidth: '600px',
          margin: '20px auto'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}