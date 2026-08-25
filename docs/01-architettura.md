# Architettura

Base ragionevolmente isolata, ma volutamente incompleta dal punto di vista applicativo.

La sicurezza non è una caratteristica che aggiungiamo alla fine: è una proprietà che deve essere costruita a ogni livello dell'applicazione.

## DB isolato nella rete interna

PostgreSQL non ha una porta pubblica e quindi non è esposto a internet

Quindi dall'esterno non possiamo semplicemente collegarci a localhost:5432

## APP non è direttamente esposta

Anche Express non pubblica la porta 3000 sull'host.

Ulteriore confine di sicurezza.

## Nginx fa da reverse proxy

In una situazione reale questo permette di centralizzare diversi controlli, per esempio:

- HTTPS/TLS;
- limitazione delle richieste;
- logging;
- rate limiting;
- alcuni header di sicurezza;
- eventuale Web Application Firewall.

## La comunicazione tra container è separata dalla rete esterna

È un esempio molto semplice del principio di segmentazione della rete.

## Variabili di ambiente

Credenziali e stringhe di connessione nelle variabili di ambiente e NON in files di progetto.
