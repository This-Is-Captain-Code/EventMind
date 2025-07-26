/**
 * RabbitMQ-based Incident Processing Queue
 * Provides reliable pub/sub messaging for incident tracking
 */

import amqp from 'amqplib';

interface IncidentMessage {
  type: 'DENSITY_ALERT' | 'SAFETY_ANALYSIS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  data: any;
  timestamp: number;
  frameId: string;
  analysisId: string;
  applicationId: string;
  streamId: string;
}

export class IncidentQueue {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly queueName = 'safety_incidents';
  private readonly exchangeName = 'safety_exchange';

  async initialize(): Promise<void> {
    try {
      // Connect to RabbitMQ (use CloudAMQP or local instance)
      const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
      this.connection = await amqp.connect(rabbitUrl);
      this.channel = await this.connection.createChannel();

      // Create exchange and queue
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
      await this.channel.assertQueue(this.queueName, { durable: true });
      
      // Bind queue to exchange
      await this.channel.bindQueue(this.queueName, this.exchangeName, 'incident.*');

      console.log('🐰 RabbitMQ Incident Queue initialized successfully');
    } catch (error) {
      console.warn('⚠️ RabbitMQ not available, using in-memory queue fallback:', error);
      // Continue without RabbitMQ for development
    }
  }

  async publishIncident(incident: IncidentMessage): Promise<void> {
    if (this.channel) {
      // Use RabbitMQ
      const routingKey = `incident.${incident.severity.toLowerCase()}`;
      const message = Buffer.from(JSON.stringify(incident));
      
      await this.channel.publish(
        this.exchangeName,
        routingKey,
        message,
        { persistent: true }
      );
      
      console.log(`📨 Published ${incident.type} incident to RabbitMQ queue`);
    } else {
      // Fallback to direct processing
      console.log(`📋 Processing ${incident.type} incident directly (no RabbitMQ)`);
      await this.processIncidentDirect(incident);
    }
  }

  async startConsumer(processor: (incident: IncidentMessage) => Promise<void>): Promise<void> {
    if (!this.channel) {
      console.log('📋 No RabbitMQ available, incidents will be processed directly');
      return;
    }

    await this.channel.consume(this.queueName, async (msg) => {
      if (msg) {
        try {
          const incident: IncidentMessage = JSON.parse(msg.content.toString());
          await processor(incident);
          this.channel!.ack(msg);
          console.log(`✅ Processed ${incident.type} incident from queue`);
        } catch (error) {
          console.error('❌ Error processing incident from queue:', error);
          this.channel!.nack(msg, false, true); // Requeue on error
        }
      }
    });

    console.log('🔄 RabbitMQ incident consumer started');
  }

  private async processIncidentDirect(incident: IncidentMessage): Promise<void> {
    // Import here to avoid circular dependency
    const { incidentTracker } = await import('./incident-tracker');
    
    if (incident.type === 'DENSITY_ALERT') {
      await incidentTracker.recordDensityIncident(incident);
    } else if (incident.type === 'SAFETY_ANALYSIS') {
      await incidentTracker.recordSafetyIncident(incident);
    }
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

export const incidentQueue = new IncidentQueue();