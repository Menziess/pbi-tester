.EXPORT_ALL_VARIABLES:

NAME=pbi-tester
AZ_SUBSCRIPTION=aaaaaaaa-bbbb-1111-cccc-abc123def456
AZ_RESOURCE_GROUP=myresourcegroup
AZ_STORAGE_ACCOUNT_NAME=mystorageaccount
AZ_LOCATION=westeurope
DOCKER_REGISTRY=mydockeruser
ACI_CPU=2
ACI_MEMORY=3
AKS_NR_CLIENTS=20
AKS_VM_SIZE=Standard_D2_v3


help:
	@echo "Tasks in \033[1;32m$$NAME\033[0m:"
	@cat Makefile

install:
	yarn install -d

dev:
	mkdir -p logs
	export PORT=3000 && node src/server.js

dockerize:
	docker build --rm -f "Dockerfile" -t \
		$$DOCKER_REGISTRY/$$NAME .

publish:
	docker push $$DOCKER_REGISTRY/$$NAME:latest

run-locally: dockerize
	mkdir -p logs

	docker network create tmp || true

	# Run server locally
	docker run --rm -d --name server \
		--network tmp \
		-p 3000:80 \
		-e ENV=production \
		$$DOCKER_REGISTRY/$$NAME:latest

	# Run client locally
	docker run -d --rm --name client \
		--network tmp \
		-p 6080:80 \
		-e WEBPAGE_URL='http://server' \
		menziess/shadow-firefox

	@echo Press ENTER to stop
	@read button
	@echo Stopping containers, removing tmp network...
	@docker container stop server client
	@docker network rm tmp

deploy: deploy-server deploy-client
	@echo Run "make cleanup" to delete all resources (requires user confirmation for each resource)

cleanup:
	@echo Press ENTER to stop and delete all cloud resources
	@read button

	# Delete AKS
	az aks delete \
		--subscription $$AZ_SUBSCRIPTION \
		--resource-group $$AZ_RESOURCE_GROUP \
		--no-wait \
		--name $$NAME

	# Delete ACI
	az container delete \
		--subscription $$AZ_SUBSCRIPTION \
		--resource-group $$AZ_RESOURCE_GROUP \
		--name $$NAME

	# Delete Storage Account
	az storage account delete \
		--subscription $$AZ_SUBSCRIPTION \
		--resource-group $$AZ_RESOURCE_GROUP \
		--name $$AZ_STORAGE_ACCOUNT_NAME

generate-token:
	@echo 1. Install powershell for linux https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-core-on-linux?view=powershell-7
	@echo
	@echo 2. Install powerbi module for powershell https://docs.microsoft.com/en-us/powershell/power-bi/overview?view=powerbi-ps
	@echo
	cd private && pwsh generate_token.ps1

deploy-server:
	@echo Deploying to $$AZ_SUBSCRIPTION

	# Create the storage account with the parameters
	az storage account create \
		--subscription $$AZ_SUBSCRIPTION \
		--resource-group $$AZ_RESOURCE_GROUP \
		--name $$AZ_STORAGE_ACCOUNT_NAME \
		--location $$AZ_LOCATION \
		--kind StorageV2 \
		--sku Standard_LRS

	# Create fileshares
	az storage share create \
		--subscription $$AZ_SUBSCRIPTION \
		--account-name $$AZ_STORAGE_ACCOUNT_NAME \
		--name $$NAME

	# ACI
	az container create \
		--subscription $$AZ_SUBSCRIPTION \
		--resource-group $$AZ_RESOURCE_GROUP \
		--name $$NAME \
		--image $$DOCKER_REGISTRY/pbi-tester \
		--dns-name-label $$NAME \
		--ports 80 443 \
		--azure-file-volume-account-name $$AZ_STORAGE_ACCOUNT_NAME \
		--azure-file-volume-account-key $$(az storage account keys list --resource-group $$AZ_RESOURCE_GROUP --account-name $$AZ_STORAGE_ACCOUNT_NAME --query "[0].value" --output tsv) \
		--azure-file-volume-share-name $$NAME \
		--azure-file-volume-mount-path /app/logs \
		--cpu $$ACI_CPU \
		--memory $$ACI_MEMORY || true

deploy-client:

	# AKS
	az aks create \
		--subscription $$AZ_SUBSCRIPTION \
		--resource-group $$AZ_RESOURCE_GROUP \
		--node-count $$AKS_NR_CLIENTS \
		--node-vm-size $$AKS_VM_SIZE \
		--name $$NAME \
		--enable-managed-identity

	# Connect to cluster
	az aks get-credentials \
		--subscription $$AZ_SUBSCRIPTION \
		--resource-group $$AZ_RESOURCE_GROUP \
		--name $$NAME
		--overwrite-existing

	# Deploy configuration
	envsubst < kubernetes/deployment.yaml | kubectl apply -f -
