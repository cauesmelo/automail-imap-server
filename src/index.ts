import { simpleParser } from 'mailparser';
import Imap, { ImapMessage } from 'imap';
import 'dotenv/config';
import api from './services/api';

setInterval(() => {
  const imap = new Imap({
    user: process.env.USERNAME || '',
    password: process.env.PASSWORD || '',
    host: process.env.HOST,
    port: 143,
    tls: false,
  });

  const searchUnread = () => {
    console.log('Searching for unread emails...');
    imap.search(['UNSEEN'], (err: Error, results) => {
      if (err) throw err;
      try {
        const search = imap.fetch(results, { bodies: '', markSeen: true });

        search.on('message', (msg: ImapMessage) => {
          msg.on('body', stream => {
            let buffer = '';
            stream.on('data', chunk => {
              buffer += chunk.toString('utf8');
            });
            stream.once('end', async () => {
              const message = await simpleParser(buffer);
              console.log(
                `Unread email found => from ${message.from?.text} | To: ${message.to?.text}`,
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
                });
            });
          });
        });
      } catch (error) {
        console.log('No e-mails to fetch.');
      }
    });
  };

  imap.once('ready', () => {
    console.log('[Imap connected.]');
    imap.openBox('INBOX', false, (err: Error) => {
      if (err) throw new Error('[!!!] Error opening email box.');

      searchUnread();
      imap.end();
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
}, 5000);
