import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Model } from 'mongoose';
import { Contact } from './modules/contacts/schemas/contact.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const contactModel = app.get<Model<Contact>>(`${Contact.name}Model`);

  try {
    // Clear existing contacts
    await contactModel.deleteMany({});
    console.log('Cleared existing contacts');

    const csvFilePath = path.resolve(__dirname, '../test-data.csv');
    const fileStream = fs.createReadStream(csvFilePath);
    const batchSize = 1000;
    let batch = [];
    let totalProcessed = 0;

    return new Promise((resolve, reject) => {
      const parser = csv({
        headers: ['id', 'name', 'email', 'age', 'status'],
        skipLines: 1
      });

      parser.on('data', async (row) => {
        batch.push({
          name: row.name,
          email: row.email,
          age: parseInt(row.age),
          status: row.status
        });

        if (batch.length >= batchSize) {
          parser.pause();
          try {
            await contactModel.insertMany(batch);
            totalProcessed += batch.length;
            console.log(`Inserted batch: ${totalProcessed} contacts`);
            batch = [];
            parser.resume();
          } catch (error) {
            console.error('Error inserting batch:', error);
            reject(error);
          }
        }
      });

      parser.on('end', async () => {
        if (batch.length > 0) {
          try {
            await contactModel.insertMany(batch);
            totalProcessed += batch.length;
            console.log(`Final batch inserted: ${totalProcessed} total contacts`);
            resolve(totalProcessed);
          } catch (error) {
            console.error('Error inserting final batch:', error);
            reject(error);
          }
        } else {
          resolve(totalProcessed);
        }
      });

      parser.on('error', (error) => {
        console.error('Error parsing CSV:', error);
        reject(error);
      });

      fileStream.pipe(parser);
    });

  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });