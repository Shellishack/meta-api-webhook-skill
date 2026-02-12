const axios = require('axios');

class MetaAPIClient {
  constructor(accessToken, apiVersion = 'v18.0') {
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
  }

  /**
   * Send a message via Messenger or Instagram
   * @param {string} recipientId - The recipient's ID
   * @param {object} message - The message object
   * @param {string} messagingType - The messaging type (RESPONSE, UPDATE, MESSAGE_TAG)
   * @returns {Promise}
   */
  async sendMessage(recipientId, message, messagingType = 'RESPONSE') {
    try {
      const payload = {
        recipient: { id: recipientId },
        message: message,
        messaging_type: messagingType
      };

      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        payload,
        {
          params: { access_token: this.accessToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a text message
   * @param {string} recipientId - The recipient's ID
   * @param {string} text - The text message
   * @returns {Promise}
   */
  async sendTextMessage(recipientId, text) {
    return this.sendMessage(recipientId, { text });
  }

  /**
   * Post a comment on a Facebook post or Instagram media
   * @param {string} objectId - The post or media ID
   * @param {string} message - The comment text
   * @returns {Promise}
   */
  async postComment(objectId, message) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${objectId}/comments`,
        null,
        {
          params: {
            access_token: this.accessToken,
            message: message
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error posting comment:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Like a post, comment, or other object
   * @param {string} objectId - The object ID to like
   * @returns {Promise}
   */
  async likeObject(objectId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${objectId}/likes`,
        null,
        {
          params: { access_token: this.accessToken }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error liking object:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Unlike a post, comment, or other object
   * @param {string} objectId - The object ID to unlike
   * @returns {Promise}
   */
  async unlikeObject(objectId) {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/${objectId}/likes`,
        {
          params: { access_token: this.accessToken }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error unliking object:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get user profile information
   * @param {string} userId - The user ID
   * @param {string[]} fields - Fields to retrieve
   * @returns {Promise}
   */
  async getUserProfile(userId, fields = ['name', 'profile_pic']) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${userId}`,
        {
          params: {
            access_token: this.accessToken,
            fields: fields.join(',')
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send typing indicator (on/off)
   * @param {string} recipientId - The recipient's ID
   * @param {boolean} isTyping - Whether typing indicator should be on or off
   * @returns {Promise}
   */
  async sendTypingIndicator(recipientId, isTyping = true) {
    try {
      const payload = {
        recipient: { id: recipientId },
        sender_action: isTyping ? 'typing_on' : 'typing_off'
      };

      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        payload,
        {
          params: { access_token: this.accessToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error sending typing indicator:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Mark message as seen
   * @param {string} recipientId - The recipient's ID
   * @returns {Promise}
   */
  async markSeen(recipientId) {
    try {
      const payload = {
        recipient: { id: recipientId },
        sender_action: 'mark_seen'
      };

      const response = await axios.post(
        `${this.baseUrl}/me/messages`,
        payload,
        {
          params: { access_token: this.accessToken },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error marking message as seen:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = MetaAPIClient;
