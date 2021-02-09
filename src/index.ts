import { simpleParser } from 'mailparser';
import Imap from 'imap';
import 'dotenv/config';
import api from './services/api';

const imap = new Imap({
  user: process.env.USERNAME || '',
  password: process.env.PASSWORD || '',
  host: process.env.HOST,
  port: 143,
  tls: false,
});

imap.once('ready', () => {
  console.log('[Imap connected.]');

  imap.openBox('INBOX', false, (err: Error) => {
    if (err) throw err;

    imap.search(['UNSEEN'], (error: Error, results) => {
      if (error) throw error;
      try {
        console.log(`Emails found: ${results.length}`);
        const f = imap.fetch(results, { bodies: '' });
        f.on('message', msg => {
          msg.on('body', stream => {
            let buffer = '';
            stream.on('data', chunk => {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', async () => {
              const message = await simpleParser(buffer);
              console.log(
                `Unread email found => FROM: ${message.from?.text} | To: ${message.to?.text} | ID: ${message.messageId}`,
              );

              const email = message.from?.value[0];

              const { date } = message;

              const head = message.headerLines
                .filter(item => item.key === 'received')
                .pop();

              const regex = head?.line.match('for <(.*?)@cauemelo.dev>');

              if (!regex)
                throw new Error('Application failed to extract followup name.');
              await api
                .post('/recipients', {
                  msgId: message.messageId,
                  subject: message.subject,
                  fromEmail: email?.address,
                  toEmail: message.to?.text,
                  sentDate: date,
                  followUpName: regex[1],
                })
                .catch(() => {
                  console.log('[!!!] Error in the request!!!');
                  console.log(`Message ID: ${message.messageId} - REJECTED`);
                });

              imap.end();
            });
          });
        });
      } catch (noEmailErr) {
        console.log('No e-mails to fetch.');
      }
    });
  });
});

imap.on('end', () => {
  console.log('[Connection closed.]');
});

try {
  imap.connect();
} catch (error) {
  console.log('[!!!] Connection error.');
}
