const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./JocTriviaMPP.db');

const QUESTIONS_TO_FINISH = 6;

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT UNIQUE NOT NULL
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_alias TEXT NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    score INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    question_ids TEXT, -- lista de id-uri de intrebari pentru acest joc
    answers TEXT,      -- lista de raspunsuri date
    stage INTEGER DEFAULT 1, -- 1: usor, 2: mediu, 3: greu
    answeredCorrect INTEGER DEFAULT 0, -- 1: a raspuns corect la cel puțin o intrebare din stagiul curent
    answered INTEGER DEFAULT 0, -- cate intrebari a raspuns in stagiul curent
    finished BOOLEAN DEFAULT 0,
    FOREIGN KEY (player_alias) REFERENCES players(alias)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    difficulty TEXT
  )`);
  
  db.get("SELECT COUNT(*) as count FROM questions", (err, row) => {
    if (row.count === 0) {
      const questions = [
        // Usor
        {
          question: 'Care este capitala Romaniei?',
          correct_answer: 'Bucuresti',
          difficulty: 'usor'
        },
        {
          question: 'Cate anotimpuri are un an?',
          correct_answer: '4',
          difficulty: 'usor'
        },
        {
          question: 'La ce Universitate dam examenul?',
          correct_answer: 'UBB',
          difficulty: 'usor'
        },
        {
          question: 'Ce ai mancat azi dimineata?',
          correct_answer: 'nimic',
          difficulty: 'usor'
        },
        // Mediu
        {
          question: 'Cine a scris poezia Luceafarul?',
          correct_answer: 'Mihai Eminescu',
          difficulty: 'mediu'
        },
        {
          question: 'Care este cel mai lung fluviu din Lume?',
          correct_answer: 'Nil',
          difficulty: 'mediu'
        },
        {
          question: 'In ce an a murit JFK?',
          correct_answer: '1963',
          difficulty: 'mediu'
        },
        {
          question: 'Care este prescurtarea la Object relational mapper?',
          correct_answer: 'ORM',
          difficulty: 'mediu'
        },
        // Greu
        {
          question: 'Cati ani am?',
          correct_answer: '20',
          difficulty: 'greu'
        },
        {
          question: 'cat face 2+2?',
          correct_answer: 'H2SO4',
          difficulty: 'greu'
        },
        {
          question: 'Cati ani are mama?',
          correct_answer: '40',
          difficulty: 'greu'
        },
        {
          question: 'cat face 1+1?',
          correct_answer: '2',
          difficulty: 'greu'
        }
      ];
      questions.forEach(q => {
        db.run("INSERT INTO questions (question, correct_answer, difficulty) VALUES (?, ?, ?)", [q.question, q.correct_answer, q.difficulty]);
      });
    }
  });
  
  db.get("SELECT COUNT(*) as count FROM players", (err, row) => {
    if (row.count === 0) {
      const players = ['player1', 'player2', 'admin'];
      players.forEach(alias => {
        db.run("INSERT INTO players (alias) VALUES (?)", [alias]);
      });
    }
  });
});

app.post('/api/start', (req, res) => {
  const { alias } = req.body;
  
  db.get("SELECT alias FROM players WHERE alias = ?", [alias], (err, player) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!player) {
      return res.status(400).json({ error: "Aliasul nu exista in baza de date!" });
    }
    
    db.all("SELECT * FROM questions", (err, allQuestions) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const easy = allQuestions.filter(q => q.difficulty === 'usor');
      const medium = allQuestions.filter(q => q.difficulty === 'mediu');
      const hard = allQuestions.filter(q => q.difficulty === 'greu');
      const questionIds = allQuestions.map(q => q.id);
      
      db.run(`INSERT INTO games (player_alias, question_ids, answers, stage, answeredCorrect, answered) VALUES (?, ?, ?, 1, 0, 0)`, 
        [alias, JSON.stringify(questionIds), '[]'], 
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          res.json({ 
            gameId: this.lastID,
            message: "Joc inceput cu succes!",
            easyQuestions: easy,
            mediumQuestions: medium,
            hardQuestions: hard
          });
        });
    });
  });
});

app.post('/api/answer', (req, res) => {
  const { gameId, questionId, answer } = req.body;
  db.get("SELECT * FROM games WHERE id = ?", [gameId], (err, game) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!game) {
      return res.status(400).json({ error: "Jocul nu exista!" });
    }

    const questionIds = JSON.parse(game.question_ids);
    let answers = JSON.parse(game.answers);

    if (!Array.isArray(answers) || answers.length !== questionIds.length) {
      answers = Array(questionIds.length).fill("");
    }

    if (!questionIds.includes(questionId)) {
      return res.status(400).json({ error: "Intrebarea nu face parte din acest joc!" });
    }

    const questionIndex = questionIds.indexOf(questionId);
    if (answers[questionIndex]) {
      return res.status(400).json({ error: "Intrebarea a fost deja raspunsa!" });
    }

    db.get("SELECT * FROM questions WHERE id = ?", [questionId], (err, question) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!question) {
        return res.status(404).json({ error: "intrebarea nu exista!" });
      }
      let stage = 1;
      if (question.difficulty === 'mediu') 
        stage = 2;
      if (question.difficulty === 'greu') 
        stage = 3;

      const isCorrect = (answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase());
      let points = isCorrect ? 4 * stage * stage : -2;
      const newScore = (game.score || 0) + points;
      answers[questionIndex] = answer.trim();
      const questionsAnswered = answers.filter(ans => ans !== null && ans !== '').length;
      const gameFinished = questionsAnswered >= QUESTIONS_TO_FINISH;

      db.run(`UPDATE games SET score = ?, questions_answered = ?, answers = ?, finished = ?, end_time = ? WHERE id = ?`,
        [newScore, questionsAnswered, JSON.stringify(answers), gameFinished ? 1 : 0, gameFinished ? new Date().toISOString() : null, gameId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({
            correct: isCorrect,
            points: points,
            score: newScore,
            questionsAnswered: questionsAnswered,
            gameFinished: gameFinished
          });
        });
    });
  });
});

app.get('/api/leaderboard', (req, res) => {
  db.all(`SELECT player_alias, start_time, score, questions_answered, finished 
          FROM games 
          ORDER BY score DESC, questions_answered ASC`, (err, games) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(games);
  });
});


app.get('/api/player/:alias/:gameId', (req, res) => {
  const { alias, gameId } = req.params;

  db.get("SELECT * FROM games WHERE id = ? AND player_alias = ?", [gameId, alias], (err, game) => {
    if (err) 
      return res.status(500).json({ error: err.message });
    if (!game) 
      return res.status(404).json({ error: "Jocul nu exista pentru acest jucator!" });

    const questionIds = JSON.parse(game.question_ids);
    const answers = JSON.parse(game.answers);
    
    db.all(`SELECT id, question, correct_answer, difficulty FROM questions WHERE id IN (${questionIds.map(() => '?').join(',')})`, questionIds, (err, questions) => {
      if (err) return res.status(500).json({ error: err.message });
      const questionsOrdered = questionIds.map(qid => questions.find(q => q.id === qid));
      const points = questionsOrdered.map((q, idx) => {
        if (!q || !answers[idx]) return 0;
        let stage = 1;
        if (q.difficulty === 'mediu') stage = 2;
        if (q.difficulty === 'greu') stage = 3;
        const isCorrect = answers[idx].trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
        return isCorrect ? 4 * stage * stage : -2;
      });
      res.json({
        questions: questionsOrdered.map(q => q ? q.question : null),
        answers: answers,
        points: points
      });
    });
  });
});


app.put('/api/question/:id', (req, res) => {
  const { id } = req.params;
  const { question, correct_answer, difficulty } = req.body;
  const fields = [];
  const values = [];

  if (question !== undefined) {
    fields.push('question = ?');
    values.push(question);
  }
  if (correct_answer !== undefined) {
    fields.push('correct_answer = ?');
    values.push(correct_answer);
  }
  if (difficulty !== undefined) {
    fields.push('difficulty = ?');
    values.push(difficulty);
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: 'Nicio modificare specificata.' });
  }
  values.push(id);
  db.run(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Intrebarea nu exista.' });
    res.json({ success: true, message: 'Intrebarea a fost modificata.' });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
