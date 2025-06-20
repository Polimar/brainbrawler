const { Kafka } = require('kafkajs');

class KafkaProducer {
  constructor() {
    // Configurazione Kafka
    const kafkaConfig = {
      clientId: process.env.KAFKA_CLIENT_ID || 'brainbrawler-game-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
    };

    // Configurazione SSL per production (CloudKarafka)
    if (process.env.KAFKA_SSL === 'true') {
      kafkaConfig.ssl = true;
      kafkaConfig.sasl = {
        mechanism: 'scram-sha-256',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
      };
    }

    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.isConnected = false;
  }

  async connect() {
    try {
      await this.producer.connect();
      this.isConnected = true;
      console.log('✅ Kafka Producer connected');
    } catch (error) {
      console.error('❌ Kafka Producer connection failed:', error);
      throw error;
    }
  }

  async send(topic, message) {
    if (!this.isConnected) {
      console.warn('⚠️  Kafka Producer not connected, skipping message');
      return;
    }

    try {
      // Aggiungi prefix per CloudKarafka se necessario
      const topicName = process.env.KAFKA_USERNAME 
        ? `${process.env.KAFKA_USERNAME}-${topic}` 
        : topic;

      const kafkaMessage = {
        key: message.roomCode || message.userId || 'default',
        value: JSON.stringify({
          ...message,
          timestamp: message.timestamp || Date.now(),
          version: '1.0'
        }),
        headers: {
          'event-type': message.type || 'unknown',
          'source': 'game-service',
          'correlation-id': this.generateCorrelationId()
        }
      };

      await this.producer.send({
        topic: topicName,
        messages: [kafkaMessage]
      });

      console.log(`📤 Kafka message sent to ${topicName}:`, message.type);
    } catch (error) {
      console.error('❌ Failed to send Kafka message:', error);
      // Non bloccare il gioco se Kafka fallisce
    }
  }

  // Metodi helper per diversi tipi di eventi
  async sendRoomEvent(type, roomCode, userId, data) {
    await this.send('room-events', {
      type,
      roomCode,
      userId,
      data
    });
  }

  async sendPlayerEvent(type, roomCode, userId, data) {
    await this.send('player-events', {
      type,
      roomCode,
      userId,
      data
    });
  }

  async sendGameEvent(type, roomCode, data) {
    await this.send('game-events', {
      type,
      roomCode,
      data
    });
  }

  async sendAnswerEvent(type, roomCode, userId, questionId, answer, timestamp) {
    await this.send('answer-events', {
      type,
      roomCode,
      userId,
      questionId,
      answer,
      timestamp
    });
  }

  async sendScoreEvent(type, roomCode, userId, score, data) {
    await this.send('score-events', {
      type,
      roomCode,
      userId,
      score,
      data
    });
  }

  async sendNotificationEvent(type, userId, data) {
    await this.send('notification-events', {
      type,
      userId,
      data
    });
  }

  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async disconnect() {
    if (this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        console.log('✅ Kafka Producer disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting Kafka Producer:', error);
      }
    }
  }

  // Health check
  async healthCheck() {
    return {
      connected: this.isConnected,
      brokers: this.kafka.brokers || [],
      clientId: this.kafka.clientId
    };
  }
}

module.exports = { KafkaProducer }; 