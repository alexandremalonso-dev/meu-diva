#!/bin/bash
gcloud compute instances start jitsi-server-prod --zone=southamerica-east1-b --quiet
echo "$(date): Jitsi ligado automaticamente" >> /var/log/jitsi-autostart.log
