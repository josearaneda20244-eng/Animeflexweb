// components/AdvancedComments.tsx
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Flag, MoreVertical, ThumbsUp, ThumbsDown, Smile, Send } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface Comment {
  id: string;
  user_id: string;
  username: string;
  avatar?: string;
  content: string;
  created_at: Date;
  updated_at?: Date;
  likes: number;
  dislikes: number;
  user_reaction?: 'like' | 'dislike';
  replies: Comment[];
  reply_count: number;
  is_pinned?: boolean;
  is_edited?: boolean;
}

interface AdvancedCommentsProps {
  animeId: string;
  episodeId?: string;
  userId?: string;
}

export default function AdvancedComments({ animeId, episodeId, userId }: AdvancedCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', animeId, episodeId],
    queryFn: () => apiClient.get<Comment[]>(`/comments/${animeId}${episodeId ? `/${episodeId}` : ''}`),
    staleTime: 1000 * 60 * 5,
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      apiClient.post('/comments', { anime_id: animeId, episode_id: episodeId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', animeId, episodeId] });
      setNewComment('');
    },
  });

  const reactToCommentMutation = useMutation({
    mutationFn: ({ commentId, reaction }: { commentId: string; reaction: 'like' | 'dislike' | null }) =>
      apiClient.post(`/comments/${commentId}/react`, { reaction }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', animeId, episodeId] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      apiClient.post(`/comments/${commentId}/reply`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', animeId, episodeId] });
      setReplyingTo(null);
      setReplyContent('');
    },
  });

  const handleReaction = (commentId: string, currentReaction: 'like' | 'dislike' | undefined) => {
    let newReaction: 'like' | 'dislike' | null = null;

    if (!currentReaction) {
      newReaction = 'like'; // Default to like if no reaction
    } else if (currentReaction === 'like') {
      newReaction = 'dislike'; // Switch to dislike
    } else {
      newReaction = null; // Remove reaction
    }

    reactToCommentMutation.mutate({ commentId, reaction: newReaction });
  };

  const emojis = ['👍', '👎', '😀', '😂', '😢', '😮', '😍', '🤔', '😡', '🙌'];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comment Form */}
      {userId && (
        <div className="bg-gray-800 rounded-lg p-4">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe un comentario..."
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEmojiPicker(showEmojiPicker === 'main' ? null : 'main')}
                className="text-gray-400 hover:text-white p-2"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => addCommentMutation.mutate(newComment)}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-6 py-2 rounded-lg text-white font-medium flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {addCommentMutation.isPending ? 'Publicando...' : 'Comentar'}
            </button>
          </div>

          {/* Emoji Picker */}
          {showEmojiPicker === 'main' && (
            <div className="mt-3 p-3 bg-gray-700 rounded-lg">
              <div className="grid grid-cols-5 gap-2">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setNewComment(prev => prev + emoji);
                      setShowEmojiPicker(null);
                    }}
                    className="text-2xl hover:bg-gray-600 p-2 rounded"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments?.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={setReplyingTo}
            onReaction={handleReaction}
            replyingTo={replyingTo}
            replyContent={replyContent}
            setReplyContent={setReplyContent}
            onSubmitReply={(content) => replyMutation.mutate({ commentId: comment.id, content })}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            emojis={emojis}
            userId={userId}
          />
        ))}

        {comments?.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Sé el primero en comentar</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  onReply: (commentId: string | null) => void;
  onReaction: (commentId: string, currentReaction: 'like' | 'dislike' | undefined) => void;
  replyingTo: string | null;
  replyContent: string;
  setReplyContent: (content: string) => void;
  onSubmitReply: (content: string) => void;
  showEmojiPicker: string | null;
  setShowEmojiPicker: (id: string | null) => void;
  emojis: string[];
  userId?: string;
}

function CommentItem({
  comment,
  onReply,
  onReaction,
  replyingTo,
  replyContent,
  setReplyContent,
  onSubmitReply,
  showEmojiPicker,
  setShowEmojiPicker,
  emojis,
  userId,
}: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${comment.is_pinned ? 'border-l-4 border-purple-500' : ''}`}>
      {/* Comment Header */}
      <div className="flex items-start gap-3 mb-3">
        <img
          src={comment.avatar || '/default-avatar.png'}
          alt={comment.username}
          className="w-10 h-10 rounded-full flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white">{comment.username}</span>
            {comment.is_pinned && (
              <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded">Fijado</span>
            )}
            {comment.is_edited && (
              <span className="text-gray-400 text-xs">(editado)</span>
            )}
          </div>
          <p className="text-gray-300 mb-2">{comment.content}</p>

          {/* Comment Actions */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>

            {/* Reactions */}
            <button
              onClick={() => onReaction(comment.id, comment.user_reaction)}
              className={`flex items-center gap-1 hover:text-red-400 transition-colors ${
                comment.user_reaction === 'like' ? 'text-red-400' : 'text-gray-400'
              }`}
            >
              <Heart className={`w-4 h-4 ${comment.user_reaction === 'like' ? 'fill-current' : ''}`} />
              <span>{comment.likes}</span>
            </button>

            <button
              onClick={() => onReaction(comment.id, comment.user_reaction)}
              className={`flex items-center gap-1 hover:text-blue-400 transition-colors ${
                comment.user_reaction === 'dislike' ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              <span>{comment.dislikes}</span>
            </button>

            {/* Reply Button */}
            {userId && (
              <button
                onClick={() => onReply(replyingTo === comment.id ? null : comment.id)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Responder
              </button>
            )}

            {/* Show Replies */}
            {comment.reply_count > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-purple-400 hover:text-purple-300"
              >
                {showReplies ? 'Ocultar' : 'Ver'} {comment.reply_count} respuesta{comment.reply_count !== 1 ? 's' : ''}
              </button>
            )}

            {/* Report */}
            <button className="text-gray-400 hover:text-red-400 ml-auto">
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Reply Form */}
      {replyingTo === comment.id && userId && (
        <div className="ml-13 mt-3 p-3 bg-gray-700 rounded-lg">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={`Responder a ${comment.username}...`}
            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            rows={2}
          />
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => setShowEmojiPicker(showEmojiPicker === `reply-${comment.id}` ? null : `reply-${comment.id}`)}
              className="text-gray-400 hover:text-white p-1"
            >
              <Smile className="w-4 h-4" />
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onReply(null)}
                className="px-3 py-1 text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => onSubmitReply(replyContent)}
                disabled={!replyContent.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-3 py-1 rounded text-white text-sm"
              >
                Responder
              </button>
            </div>
          </div>

          {/* Emoji Picker for Reply */}
          {showEmojiPicker === `reply-${comment.id}` && (
            <div className="mt-2 p-2 bg-gray-600 rounded">
              <div className="grid grid-cols-5 gap-1">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setReplyContent(replyContent + emoji);
                      setShowEmojiPicker(null);
                    }}
                    className="text-xl hover:bg-gray-500 p-1 rounded"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Replies */}
      {showReplies && comment.replies && (
        <div className="ml-13 mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <img
                src={reply.avatar || '/default-avatar.png'}
                alt={reply.username}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
              <div className="flex-1 bg-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white text-sm">{reply.username}</span>
                  <span className="text-gray-500 text-xs">
                    {new Date(reply.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-300 text-sm">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}