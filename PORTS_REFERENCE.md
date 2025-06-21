# BrainBrawler - Riferimento Porte

## Configurazione Porte Sistema

### Servizi Principali
- **Frontend Web**: `:3001` (Container: bb_frontend)
  - Accesso: http://10.40.10.180:3001
  - Serve i file HTML/CSS/JS
  
- **Backend API**: `:3000` (Container: bb_backend) 
  - Accesso: http://10.40.10.180:3000
  - Endpoint API REST + WebSocket

### Database e Cache
- **PostgreSQL**: `:5432` (Container: bb_postgres)
- **Redis**: `:6379` (Container: bb_redis)

### Messaging
- **Kafka**: `:9092` (interno), `:29092` (esterno, Container: bb_kafka)
- **Zookeeper**: `:2181` (Container: bb_zookeeper)

### Monitoring Tools
- **Adminer** (DB Admin): `:8080` (Container: bb_adminer)
- **Kafka UI**: `:8090` (Container: bb_kafka_ui)

## Comunicazione Inter-Servizi

### Frontend → Backend
```javascript
const API_BASE = `http://${window.location.hostname}:3000`;
```

### Backend → Frontend (CORS)
```javascript
origin: "http://10.40.10.180:3001"
```

### Backend → Database
```
DATABASE_URL=postgresql://postgres:brainbrawler_dev@postgres:5432/brainbrawler
```

## URL di Accesso Esterni

- **Landing Page**: http://10.40.10.180:3001
- **Lobby**: http://10.40.10.180:3001/lobby.html  
- **Test Page**: http://10.40.10.180:3001/test.html
- **Email Verify**: http://10.40.10.180:3001/verify-email.html
- **API Health**: http://10.40.10.180:3000/health
- **DB Admin**: http://10.40.10.180:8080
- **Kafka Monitor**: http://10.40.10.180:8090

## Note Importanti

1. **Frontend** (porta 3001) fa chiamate API al **Backend** (porta 3000)
2. **Backend** ha CORS configurato per accettare da porta 3001
3. **Container Network**: Tutti i servizi comunicano via nome container
4. **Host Access**: Solo le porte mappate sono accessibili dall'host

## Docker Compose Mapping

```yaml
frontend:
  ports: "3001:3001"  # host:container
backend: 
  ports: "3000:3000"  # host:container
``` 