# Among Legends

Voici la copy, open-source de Among Legends de Solary

## Prérequis
- [Node.js](https://nodejs.org/en/download)
- Npm (inclus avec Node.js)

## Optionel
- [Ngrok](https://ngrok.com/) (ou tout autre outil pour exporter un site local vers un site public)

## Installation
```bash
npm install
```

## Start
```bash
npm start
```
---
## Avec Ngrok
#### Dans un terminal
```bash
npm start
```
#### Dans un autre terminal
```bash
ngrok http <port-local-du-server>
```
(le port local est donné dans la console lorsque vous lancez le serveur)
maintenant, vous pouvez inviter vos amis avec le lien généré par ngrok

---
Pour changer le port du serveur, allez en bas du fichier server.js
![alt text](demo.png)