import { simpleParser } from 'mailparser';
import Imap, { ImapMessage, Box } from 'imap';
import 'dotenv/config';

const imap = new Imap({
  user: process.env.USERNAME || '',
  password: process.env.PASSWORD || '',
  host: process.env.HOST,
  port: 143,
  tls: false,
});

const searchUnread = () => {
  imap.search(['UNSEEN'], (err: Error, results) => {
    if (err) throw err;

    const search = imap.fetch(results, { bodies: '' });

    search.on('message', (msg: ImapMessage) => {
      msg.on('body', (stream, info) => {
        let buffer = '';
        stream.on('data', chunk => {
          buffer += chunk.toString('utf8');
        });
        stream.once('end', async () => {
          const message = await simpleParser(buffer);
          // console.log(`Enviado por: ${message.from?.text}`);
          console.log(`Mensagem: \n ${message.subject}`);
        });
      });
    });
  });
};

imap.once('ready', () => {
  console.log('Imap connected.');

  imap.openBox('INBOX', false, (err: Error, mailbox: Box) => {
    if (err) throw new Error('Error opening email box.');
    searchUnread();

    imap.on('mail', (numMSG: number) => {
      console.log(`Novas mensagens: ${numMSG}`);
      searchUnread();
    });
  });
});

imap.connect();
