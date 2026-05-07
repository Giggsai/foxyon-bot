const memory = new Map();

function getHistory(userId) {
  return memory.get(userId) || [];
}

function saveMessage(userId, role, content) {
  const history = getHistory(userId);

  history.push({ role, content });

  if (history.length > 10) {
    history.shift();
  }

  memory.set(userId, history);
}

module.exports = {
  getHistory,
  saveMessage,
};
