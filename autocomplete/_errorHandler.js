
export const MAX_OPTIONS = 25;

export default function onError(err)
{
	// Ignore the 'Unknown Interaction' that happens when the command was cancelled
	if(error.status !== 404)
		error(err);
}