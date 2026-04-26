import { useState, useRef, useEffect } from 'react';
import {
  SwipeableDrawer, Box, Typography, TextField, IconButton,
  CircularProgress, Paper, Divider
} from '@mui/material';
import SendRounded from '@mui/icons-material/SendRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { aiApi } from '../../api/ai';

export default function AiChatDrawer({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await aiApi.getAdvice(text, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.message }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      PaperProps={{ sx: { borderRadius: '16px 16px 0 0', height: '70vh', display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeRounded color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
          AI Coach
        </Typography>
        {messages.length > 0 && (
          <IconButton size="small" onClick={() => setMessages([])} title="Clear chat">
            <DeleteOutlineRounded fontSize="small" />
          </IconButton>
        )}
        <IconButton size="small" onClick={onClose}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </Box>
      <Divider />

      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {messages.length === 0 && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1, opacity: 0.5 }}>
            <AutoAwesomeRounded sx={{ fontSize: 40 }} />
            <Typography variant="body2" textAlign="center">
              Ask me anything about your training — programming, form tips, recovery, nutrition…
            </Typography>
          </Box>
        )}
        {messages.map((msg, i) => (
          <Box
            key={i}
            sx={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                bgcolor: msg.role === 'user' ? 'primary.main' : 'action.hover',
                color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {msg.content}
              </Typography>
            </Paper>
          </Box>
        ))}
        {loading && (
          <Box sx={{ alignSelf: 'flex-start' }}>
            <Paper elevation={0} sx={{ px: 1.5, py: 1, borderRadius: '16px 16px 16px 4px', bgcolor: 'action.hover' }}>
              <CircularProgress size={16} />
            </Paper>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Input */}
      <Divider />
      <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="Ask your AI coach…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <IconButton color="primary" onClick={send} disabled={loading || !input.trim()}>
          <SendRounded />
        </IconButton>
      </Box>
    </SwipeableDrawer>
  );
}
