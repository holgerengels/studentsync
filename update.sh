git pull

cd client ; npm run build ; cd - ; sudo docker build -t sync-nginx -f nginx.docker .
cp client/dist/index.html server/src/main/webapp/index.html
cd server ; mvn install ; cd - ; sudo docker build -t sync-jetty -f jetty.docker .

sudo docker-compose down ; sudo docker-compose up -d

