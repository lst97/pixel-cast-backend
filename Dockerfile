FROM denoland/deno:alpine

WORKDIR /app

# The DENO_DIR environment variable is used to specify the directory where Deno caches dependencies.
# Caching these dependencies will speed up subsequent builds by avoiding re-downloading them every time.
# We copy the dependency configuration files first to leverage Docker's layer caching.
COPY deno.json deno.lock /app/

# The `deno cache` command downloads and caches all the dependencies specified in the deno.json and deno.lock files.
# The --lock=deno.lock flag ensures that the exact versions of the dependencies from the lock file are used.
RUN deno cache main.ts --lock=deno.lock

# Copy the environment file
COPY .env ./

# Copy the rest of the application source code into the container.
# This includes all the .ts files, routes, and other necessary assets.
COPY . .

# The EXPOSE instruction informs Docker that the container listens on the specified network ports at runtime.
# It does not actually publish the port. This is more of a documentation between the person who builds the image and the person who runs the container.
# Our backend server is configured to run on port 3001.
EXPOSE 3001

# The CMD instruction provides the default command to be executed when the container starts.
# `deno run` is used to execute the main application script.
# The --allow-all flag grants all runtime permissions to the application.
# This is a convenient but less secure option. For production, it's better to specify only the required permissions (e.g., --allow-net, --allow-read).
# main.ts is the entry point of our backend application.
CMD ["run", "--allow-all", "main.ts"] 